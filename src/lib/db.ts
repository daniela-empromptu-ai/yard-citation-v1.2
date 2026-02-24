const API_BASE = 'https://builder-api.staging.empromptu.ai'
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.API_AUTH_TOKEN || 'd4d5ed47d417b7e549dd4d2437410203'}`,
  'X-Generated-App-ID': process.env.API_APP_ID || '81cf7fb7-67cd-4de2-bf73-193203e3ddb4',
  'X-Usage-Key': process.env.API_USAGE_KEY || 'e59f58ae3bfc0374ac121f49a55d1354',
}

export interface QueryResult<T = Record<string, unknown>> {
  success: boolean
  data: T[]
  row_count: number
  affected_rows: number
  message: string
  error?: string
}

export async function dbQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const res = await fetch(`${API_BASE}/database/query`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({ query, params }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DB query failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function dbSchema(schema: object): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/database/schema`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify(schema),
  })
  // 304 = already up to date, treat as ok
  if (res.status === 304 || res.ok) {
    return { ok: true, message: 'Schema applied' }
  }
  const text = await res.text()
  throw new Error(`Schema failed (${res.status}): ${text}`)
}

export function t(tableName: string): string {
  return tableName
}

export async function callAIApi(endpoint: string, body: object): Promise<unknown> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI API ${endpoint} failed (${res.status}): ${text}`)
  }
  return res.json()
}
