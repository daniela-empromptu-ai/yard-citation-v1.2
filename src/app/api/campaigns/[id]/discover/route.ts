import { NextRequest, NextResponse } from 'next/server';
import { runDiscovery } from '@/lib/discovery';
import { dbQuery, t } from '@/lib/db';

interface RouteContext {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const campaignId = params.id;

  try {
    const body = await req.json();
    const { user_id, llm_count, db_limit } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Verify campaign exists
    const campRes = await dbQuery<{ id: string }>(
      `SELECT id FROM ${t('campaigns')} WHERE id = $1`,
      [campaignId]
    );
    if (campRes.data.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Run discovery (DB match + LLM)
    const result = await runDiscovery(campaignId, user_id, {
      llmCount: llm_count || 20,
      dbLimit: db_limit || 50,
    });

    // Update campaign stage
    await dbQuery(
      `UPDATE ${t('campaigns')} SET stage = 'discovery', updated_at = now() WHERE id = $1`,
      [campaignId]
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (e) {
    console.error('Discovery error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
