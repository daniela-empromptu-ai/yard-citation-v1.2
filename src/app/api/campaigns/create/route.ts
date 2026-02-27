import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t, pgArray } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      client_id, new_client_name, name, geo_targets, language, product_category,
      creative_brief, owner_user_id, personas = [], topics = [], prompt_gaps = [],
    } = body;

    const now = new Date().toISOString();

    // Create client if needed
    let finalClientId = client_id;
    if (client_id === 'new' && new_client_name) {
      const newClientId = uuidv4();
      await dbQuery(
        `INSERT INTO ${t('clients')} (id, name, created_at, updated_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [newClientId, new_client_name, now, now]
      );
      finalClientId = newClientId;
    }

    // Create campaign
    const campaignId = uuidv4();
    const geoArr = geo_targets || [];
    const r = await dbQuery(
      `INSERT INTO ${t('campaigns')} (id, client_id, name, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'active','draft',$5,$6,$7,$8,$9,$10) RETURNING id`,
      [campaignId, finalClientId, name, owner_user_id, geoArr, language || 'English', product_category || null, creative_brief || '', now, now]
    );

    if (!r.success) {
      return NextResponse.json({ error: r.error || r.message }, { status: 500 });
    }

    // Insert personas
    for (const persona of personas) {
      await dbQuery(
        `INSERT INTO ${t('campaign_personas')} (id, campaign_id, persona_name, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [uuidv4(), campaignId, persona, now]
      );
    }

    // Insert topics
    for (let i = 0; i < topics.length; i++) {
      await dbQuery(
        `INSERT INTO ${t('campaign_topics')} (id, campaign_id, topic, source, order_index, approved, created_at) VALUES ($1,$2,$3,'manual',$4,true,$5) ON CONFLICT DO NOTHING`,
        [uuidv4(), campaignId, topics[i], i, now]
      );
    }

    // Insert prompt gaps
    for (const gap of prompt_gaps) {
      await dbQuery(
        `INSERT INTO ${t('campaign_prompt_gaps')} (id, campaign_id, prompt_text, priority, status, geo, created_at, updated_at) VALUES ($1,$2,$3,$4,'draft','{}',$5,$6)`,
        [uuidv4(), campaignId, gap.prompt_text, gap.priority || 'medium', now, now]
      );
    }

    // Log activity
    await dbQuery(
      `INSERT INTO ${t('activity_log')} (campaign_id, actor_user_id, event_type, event_data_json, created_at) VALUES ($1,$2,'campaign_created',$3::jsonb,$4)`,
      [campaignId, owner_user_id, JSON.stringify({ name }), now]
    );

    // Fire discovery scan in background (non-blocking)
    let scanStatus: 'started' | 'skipped' = 'skipped';
    if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID && topics.length > 0) {
      const origin = req.nextUrl.origin;
      fetch(`${origin}/api/campaigns/${campaignId}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: owner_user_id }),
      }).catch(err => console.error('Background discovery scan failed:', err));
      scanStatus = 'started';
    }

    return NextResponse.json({ campaign_id: campaignId, scan_status: scanStatus });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
