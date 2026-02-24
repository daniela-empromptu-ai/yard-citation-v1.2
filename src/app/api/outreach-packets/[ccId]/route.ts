import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { ccId: string } }) {
  const res = await dbQuery(
    `SELECT * FROM ${t('outreach_packets')} WHERE campaign_creator_id = $1`,
    [params.ccId]
  );
  return NextResponse.json({ packet: res.data[0] || null });
}
