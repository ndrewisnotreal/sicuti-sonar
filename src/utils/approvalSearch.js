export function matchesApprovalSearch(r, query) {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    const name = (r.requester_name || r.userName || '').toLowerCase();
    const id = String(r.id_request || r.id || '').toLowerCase();
    const type = (r.nm_leave_type || r.leaveTypeName || r.kd_leave_type || '').toLowerCase();
    return name.includes(q) || id.includes(q) || type.includes(q);
}
