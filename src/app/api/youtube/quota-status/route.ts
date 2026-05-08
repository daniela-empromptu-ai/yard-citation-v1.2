import { NextResponse } from 'next/server'
import { hasBackupKey, isUsingBackupKey, isQuotaExceeded } from '@/lib/youtube'

const PRIMARY = process.env.YOUTUBE_API_KEY || ''
const BACKUP = process.env.YOUTUBE_API_KEY_BACKUP || ''

// channels.list is 1 quota unit per call (cheaper than search.list which is 100).
const PROBE_URL = (key: string) =>
  `https://www.googleapis.com/youtube/v3/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${key}`

async function probe(key: string): Promise<{ ok: boolean; quota_exceeded: boolean }> {
  if (!key) return { ok: false, quota_exceeded: false }
  try {
    const res = await fetch(PROBE_URL(key), { signal: AbortSignal.timeout(5000) })
    if (res.ok) return { ok: true, quota_exceeded: false }
    const body = await res.json().catch(() => ({}))
    return { ok: false, quota_exceeded: isQuotaExceeded(res.status, body) }
  } catch {
    return { ok: false, quota_exceeded: false }
  }
}

export async function GET() {
  // Probe primary + backup in parallel. ~1 quota unit each on success.
  const [primary, backup] = await Promise.all([
    probe(PRIMARY),
    BACKUP ? probe(BACKUP) : Promise.resolve({ ok: false, quota_exceeded: false }),
  ])

  const anyKeyOk = primary.ok || backup.ok
  return NextResponse.json({
    has_primary: !!PRIMARY,
    has_backup: hasBackupKey(),
    primary_ok: primary.ok,
    primary_quota_exceeded: primary.quota_exceeded,
    backup_ok: backup.ok,
    backup_quota_exceeded: backup.quota_exceeded,
    using_backup_in_process: isUsingBackupKey(),
    any_key_ok: anyKeyOk,
    // Severity for UI: 'ok' | 'degraded' (primary out, backup works) | 'blocked' (no working key)
    severity: anyKeyOk
      ? (primary.ok ? 'ok' : 'degraded')
      : 'blocked',
  })
}
