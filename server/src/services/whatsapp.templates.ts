// Las plantillas WhatsApp para task_due, stage_overdue, progress_milestone,
// substage_blocked, project_delayed y stage_changed se eliminaron en mayo
// 2026 junto con el dispatcher que las usaba (notify.service/dispatchChannels).
// Hoy WhatsApp solo lo usan los servicios deadline-warnings y
// substage-notifications, que arman el texto inline.
export {};
