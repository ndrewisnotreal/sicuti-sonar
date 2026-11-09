import api from './api';

export const leaveService = {
    async getMyLeaves(params = {}) {
        const res = await api.get('/sicuti/leave-request/mine', params);
        if (Array.isArray(res?.data?.data)) return res.data.data;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res)) return res;
        return [];
    },

    async getLeaveDetail(id) {
        const safeId = encodeURIComponent(id);
        const res = await api.get(`/sicuti/leave-request/${safeId}`);
        if (res?.data?.id_request || res?.data?.id) return res.data;
        if (res?.data?.data) return res.data.data;
        return res?.data || res;
    },

    async uploadDocument(fileOrFormData) {
        let formData;
        if (typeof FormData !== 'undefined' && fileOrFormData instanceof FormData) {
            formData = fileOrFormData;
        } else {
            formData = new FormData();
            formData.append('file', fileOrFormData);
        }
        const res = await api.upload('/sicuti/leave-request/upload', formData);
        return res?.data !== undefined ? res.data : res;
    },

    async completeDocument(idRequest, file) {
        const uploaded = await this.uploadDocument(file);
        const url = uploaded?.url || uploaded?.file_path;
        const res = await api.put('/sicuti/leave-request/document', {
            id_request: idRequest,
            attachment_url: url,
            attachment_name: file?.name || uploaded?.fileName
        });
        return res?.data !== undefined ? res.data : res;
    },

    async createLeave(data) {
        const payload = {
            uid_user_system: data.uid_user_system || undefined,
            kd_leave_type: data.kd_leave_type || data.id_leave_type || data.leaveTypeId,
            start_date: data.start_date || data.startDate,
            end_date: data.end_date || data.endDate,
            reason: data.reason || undefined,
            substitute_id: data.substitute_id || data.substituteId || undefined,
            attachment_url: data.attachment_url || undefined,
            attachment_name: data.attachment_name || undefined,
            ...(data.is_draft ? { is_draft: true } : {})
        };
        const res = await api.post('/sicuti/leave-request', payload);
        return res?.data !== undefined ? res.data : res;
    },

    async resubmitLeave(id, data) {
        const safeId = encodeURIComponent(id);
        const payload = {
            kd_leave_type: data.kd_leave_type || data.id_leave_type || data.leaveTypeId,
            start_date: data.start_date || data.startDate,
            end_date: data.end_date || data.endDate,
            reason: data.reason || undefined,
            substitute_id: data.substitute_id || data.substituteId || undefined,
            total_days: data.total_days || data.totalDays || undefined,
            attachment_url: data.attachment_url || undefined,
            attachment_name: data.attachment_name || undefined,
            ...(data.is_draft ? { is_draft: true } : {})
        };
        try {
            const res = await api.put(`/sicuti/leave-request/${safeId}`, payload);
            return res?.data !== undefined ? res.data : res;
        } catch (err) {
            if (err.status === 404 || err.status === 405) {
                const res = await api.put(`/sicuti/leave-request/${safeId}/resubmit`, payload);
                return res?.data !== undefined ? res.data : res;
            }
            throw err;
        }
    },

    async cancelLeave(id) {
        const reqId = typeof id === 'object' && id !== null ? (id.id_request || id.id) : id;
        const res = await api.post('/sicuti/leave-request/cancel', { id_request: reqId });
        return res?.data !== undefined ? res.data : res;
    },

    async getBalances(params = {}) {
        const query = typeof params === 'object' ? params : { year: params };
        const res = await api.get('/sicuti/leave-balance/me', query);
        const data = res?.data !== undefined ? res.data : res;
        return Array.isArray(data) ? data : (data ? [data] : []);
    },

    async getBalanceMutations(params = {}) {
        const query = typeof params === 'object' ? params : { year: params };
        const year = Number(query.year || new Date().getFullYear());

        const [bals, historyRes] = await Promise.all([
            query.balances !== undefined ? Promise.resolve(query.balances).catch(() => []) : this.getBalances({ year }).catch(() => []),
            // Galat riwayat diteruskan ke halaman agar tidak tampil sebagai riwayat pendek (audit-028 #11, izin pengguna 2026-11-08).
            api.get('/sicuti/leave-balance/history', { year })
        ]);

        const balList = Array.isArray(bals) ? bals : bals ? [bals] : [];
        const current = balList.find((b) => Number(b.year) === year) || balList[0];
        const mutations = [];

        if (current) {
            const periodStart = current.period_start || `${year}-01-01`;
            mutations.push({
                id: `quota-${year}`,
                year,
                type: 'credit',
                amount: Number(current.annual_quota || 0),
                description: `Kuota cuti tahunan periode ${current.period_label || year}`,
                date: periodStart
            });
            const carryOver = Number(current.carry_over_days || 0);
            if (carryOver > 0) {
                mutations.push({
                    id: `carry-${year}`,
                    year,
                    type: 'credit',
                    amount: carryOver,
                    description: 'Sisa cuti tahun lalu',
                    expiry: current.carry_over_expiry_date || null,
                    date: periodStart
                });
            }
        }

        const history = Array.isArray(historyRes?.data) ? historyRes.data : Array.isArray(historyRes) ? historyRes : [];
        for (const m of history) {
            const kind = String(m.type || '').toLowerCase();
            const isCredit = ['credit', 'refund', 'init', 'tambah', 'carry_over'].includes(kind) || (kind === 'adjust' && Number(m.amount) >= 0);
            mutations.push({
                id: m.id_history || m.id,
                year: Number(m.year || year),
                type: isCredit ? 'credit' : 'debit',
                amount: Math.abs(Number(m.amount || 0)),
                description: m.reason || (isCredit ? 'Pengembalian saldo' : 'Penggunaan cuti'),
                date: m.created_at
            });
        }

        mutations.sort((a, b) => new Date(a.date) - new Date(b.date));
        return mutations;
    },

    async getBalanceHistory(params = {}) {
        return this.getBalanceMutations(params);
    },

    async getLeaveTypes(all = false) {
        const res = await api.get('/sicuti/leave-type', all ? { all: 'true' } : {});
        const data = res?.data !== undefined ? res.data : res;
        return Array.isArray(data) ? data : [];
    },

    async getColleagues() {
        const res = await api.get('/master/user/colleagues');
        const data = res?.data !== undefined ? res.data : res;
        return Array.isArray(data) ? data : [];
    },

    async getHolidays(year = new Date().getFullYear()) {
        const res = await api.get('/sicuti/holiday', { year });
        const data = res?.data !== undefined ? res.data : res;
        return Array.isArray(data) ? data : [];
    }
};

export default leaveService;
