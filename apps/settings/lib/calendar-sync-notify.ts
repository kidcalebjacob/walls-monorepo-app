/**
 * Hooks for calendar sync workers after connect/disconnect.
 * Port full implementation from the main app when the sync service is wired up.
 */
export async function notifyCalendarSyncSetup(_connectionId: string): Promise<void> {
  // No-op until calendar sync backend is connected in this monorepo.
}

export async function notifyCalendarSyncTeardown(_connectionId: string): Promise<void> {
  // No-op until calendar sync backend is connected in this monorepo.
}
