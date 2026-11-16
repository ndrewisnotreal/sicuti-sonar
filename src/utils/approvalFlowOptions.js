function usedElsewhere(flows, editingFlowId) {
    const used = new Map();
    for (const f of flows || []) {
        if (f.id_flow === editingFlowId) continue;
        for (const a of f.approvers || []) used.set(a.uid_user_system, f.nm_flow);
    }
    return used;
}

export function approverChoices(eligible, flows, editingFlowId, templateDept) {
    const used = usedElsewhere(flows, editingFlowId);
    return (eligible || []).map((u) => {
        const where = used.get(u.uid_user_system);
        const otherDept = Boolean(templateDept && u.kd_dept && u.kd_dept !== templateDept);
        const note = otherDept ? ` · departemen ${u.kd_dept}` : where ? ` · sudah di tingkat ${where}` : '';
        return {
            value: u.uid_user_system,
            label: `${u.nama} · ${u.nm_role || u.kd_role}${note}`,
            disabled: otherDept || Boolean(where)
        };
    });
}

export function defaultApprovers(eligible, flows, kdRole, kdDept) {
    if (!kdRole) return [];
    const used = usedElsewhere(flows, null);
    return (eligible || [])
        .filter((u) => u.kd_role === kdRole && (!kdDept || !u.kd_dept || u.kd_dept === kdDept) && !used.has(u.uid_user_system))
        .map((u) => u.uid_user_system);
}

export function memberChoices(candidates, templateDept) {
    return (candidates || []).map((u) => {
        const otherDept = Boolean(templateDept && u.kd_dept && u.kd_dept !== templateDept);
        const note = otherDept ? ` · departemen ${u.kd_dept}` : u.nm_template ? ` · sudah di ${u.nm_template}` : '';
        return {
            value: u.uid_user_system,
            label: `${u.nama} · ${u.nm_role || u.kd_role}${note}${u.is_approver ? ' · approver' : ''}`,
            disabled: otherDept || Boolean(u.nm_template)
        };
    });
}

// Peran dan approver sama-sama wajib, di mode Tambah maupun Ubah (tingkat tanpa approver tidak bisa memproses apa pun).
export function flowFormProblems(form) {
    return {
        role: form?.assigned_role ? '' : 'Pilih peran untuk tingkat ini.',
        users: (form?.users || []).length ? '' : 'Pilih minimal satu approver untuk tingkat ini.'
    };
}
