import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET() {
  try {
    const [settings, integrations, lastSeed] = await Promise.all([
      dbQuery(`SELECT * FROM app_settings LIMIT 1`, []),
      dbQuery(`SELECT * FROM integration_status ORDER BY integration_key`, []),
      dbQuery(`SELECT dsr.*, u.name as seeded_by_name FROM demo_seed_runs dsr LEFT JOIN app_users u ON u.id = dsr.seeded_by_user_id ORDER BY dsr.seeded_at DESC LIMIT 1`, []),
    ])
    return NextResponse.json({
      settings: settings.data[0] || null,
      integrations: integrations.data,
      lastSeed: lastSeed.data[0] || null,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { mask_pii_by_default, outreach_ready_score_threshold, min_evidence_coverage } = body

    const existing = await dbQuery(`SELECT id FROM app_settings LIMIT 1`, [])
    if (existing.data.length) {
      await dbQuery(
        `UPDATE app_settings SET mask_pii_by_default=$1, outreach_ready_score_threshold=$2, min_evidence_coverage=$3, updated_at=now()`,
        [mask_pii_by_default, outreach_ready_score_threshold, min_evidence_coverage]
      )
    } else {
      await dbQuery(
        `INSERT INTO app_settings (id, mask_pii_by_default, outreach_ready_score_threshold, min_evidence_coverage, created_at, updated_at)
         VALUES (gen_random_uuid(),$1,$2,$3,now(),now())`,
        [mask_pii_by_default, outreach_ready_score_threshold, min_evidence_coverage]
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
