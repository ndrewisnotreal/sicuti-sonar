import { api } from '@/service/api';

export function attachmentInfo(req) {
    const url = req?.attachment_url || '';
    const doc = req?.documents?.[0];
    const name = req?.attachment_name || (url ? url.split('/').pop() : doc?.file_name || doc?.fileName || '');
    if (!name) return null;
    const hasFile = /^\/uploads\/documents\/[A-Za-z0-9._-]+$/.test(url);
    return { name, hasFile, isImage: hasFile && /\.(png|jpe?g)$/i.test(url), idRequest: req?.id_request || req?.id };
}

export async function fetchAttachmentUrl(idRequest) {
    const { blob } = await api.blob('/sicuti/leave-request/attachment', { id_request: idRequest });
    return URL.createObjectURL(blob);
}

export async function openAttachment(idRequest) {
    const win = window.open('', '_blank');
    try {
        const url = await fetchAttachmentUrl(idRequest);
        if (win) win.location.href = url;
        else window.location.href = url;
        // Tab baru butuh waktu untuk memuat blob sebelum URL-nya dilepas.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
        win?.close();
        throw err;
    }
}

export function documentPending(req) {
    return Boolean(req?.document_due_date) && !req?.attachment_url && !(req?.documents || []).length;
}
