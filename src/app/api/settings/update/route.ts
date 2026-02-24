import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const { threshold, min_coverage, mask_pii } = await req.json();
  const now = new Date().toISOString();

  // Upsert settings
  const existing = await dbQuery(`SELECT id FROM ${t('app_settings')} LIMIT 1`);
  if (existing.data.length > 0) {
    await dbQuery(
      `UPDATE ${t('app_settings')} SET outreach_ready_score_threshold=$1, min_evidence_coverage=$2, mask_pii_by_default=$3, updated_at=$4`,
      [threshold, min_coverage, mask_pii, now]
    );
  } else {
    await dbQuery(
      `INSERT INTO ${t('app_settings')} (id, outreach_ready_score_threshold, min_evidence_coverage, mask_pii_by_default, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuidv4(), threshold, min_coverage, mask_pii, now, now]
    );
  }

  return NextResponse.json({ ok: true });
}
