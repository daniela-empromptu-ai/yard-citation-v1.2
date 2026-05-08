/**
 * Process-wide YouTube API key state with automatic failover.
 *
 * YouTube quotas reset daily at midnight Pacific. When the primary key is
 * exhausted, callers report it via reportQuotaExhausted() and we flip to
 * the backup key for the rest of the process lifetime. Cold start re-reads
 * env, so a fresh deploy after midnight picks up the recovered primary.
 */

let activeKey: string = process.env.YOUTUBE_API_KEY || ''
const backupKey: string = process.env.YOUTUBE_API_KEY_BACKUP || ''
let usingBackup = false

export function getYouTubeKey(): string {
  return activeKey
}

export function hasBackupKey(): boolean {
  return !!backupKey
}

export function isUsingBackupKey(): boolean {
  return usingBackup
}

/**
 * Flip to the backup key. Returns true if the caller should retry with the
 * new key, false if there's nowhere else to fall back to.
 */
export function reportQuotaExhausted(context: string): boolean {
  if (!usingBackup && backupKey) {
    console.warn(`[youtube] Primary key quota exhausted (${context}) — failing over to backup`)
    activeKey = backupKey
    usingBackup = true
    return true
  }
  return false
}

/**
 * True if the response is a 403/quotaExceeded error from YouTube.
 * Pass the cloned/parsed JSON body — caller decides whether to read it.
 */
export function isQuotaExceeded(status: number, body: unknown): boolean {
  if (status !== 403) return false
  const errors = (body as { error?: { errors?: Array<{ reason?: string }> } })?.error?.errors
  return Array.isArray(errors) && errors.some(e => e?.reason === 'quotaExceeded')
}
