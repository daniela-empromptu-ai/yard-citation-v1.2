import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';
import { v5 as uuidv5 } from 'uuid';
import { fetchSheetRows, parseSheet, groupByCreator } from '@/lib/google-sheets';
import { matchCreatorsToTopics, MatchedCreator } from '@/lib/discovery-scan';

// Deterministic UUID namespace for sheet creator IDs
const CREATOR_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace

const BATCH_SIZE = 10;

interface RouteContext {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const campaignId = params.id;

  try {
    const body = await req.json();
    const { spreadsheet_id, user_id, range, top_n } = body;

    const sheetId = spreadsheet_id || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!sheetId) {
      return NextResponse.json({ error: 'No spreadsheet_id provided and GOOGLE_SHEETS_SPREADSHEET_ID not set' }, { status: 400 });
    }
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // 1. Load campaign topics (approved ones, fall back to all if none approved)
    const topicsRes = await dbQuery<{ topic: string; approved: boolean }>(
      `SELECT topic, approved FROM ${t('campaign_topics')} WHERE campaign_id = $1`,
      [campaignId]
    );
    if (!topicsRes.success) {
      return NextResponse.json({ error: 'Failed to load campaign topics' }, { status: 500 });
    }
    // Prefer approved topics, but use all if none are explicitly approved
    let campaignTopics = topicsRes.data.filter(r => r.approved).map(r => r.topic);
    if (campaignTopics.length === 0) {
      campaignTopics = topicsRes.data.map(r => r.topic);
    }
    if (campaignTopics.length === 0) {
      return NextResponse.json({ error: 'No approved topics for this campaign. Add topics before scanning.' }, { status: 400 });
    }

    // 2. Fetch sheet
    const rawRows = await fetchSheetRows(sheetId, range || undefined);
    if (rawRows.length < 1) {
      return NextResponse.json({ error: 'Sheet is empty or has no data rows' }, { status: 400 });
    }

    // 3. Auto-detect headers + parse rows
    const { rows: dataRows, warnings } = parseSheet(rawRows);
    if (dataRows.length === 0) {
      return NextResponse.json({ error: 'No data rows found in sheet' }, { status: 400 });
    }

    // 4. Group by creator
    const grouped = groupByCreator(dataRows);

    // 5. Match topics
    const matched = matchCreatorsToTopics(grouped, campaignTopics, top_n || 100);

    // 6. Upsert to DB in batches
    let inserted = 0;
    for (let i = 0; i < matched.length; i += BATCH_SIZE) {
      const batch = matched.slice(i, i + BATCH_SIZE);
      await upsertBatch(batch, campaignId, user_id);
      inserted += batch.length;
    }

    // 7. Log activity
    await dbQuery(
      `INSERT INTO ${t('activity_log')} (campaign_id, actor_user_id, event_type, event_data_json, created_at)
       VALUES ($1, $2, 'discovery_scan', $3::jsonb, now())`,
      [campaignId, user_id, JSON.stringify({
        spreadsheet_id: sheetId,
        total_sheet_rows: dataRows.length,
        grouped_creators: grouped.length,
        matched: matched.length,
        inserted,
        warnings,
      })]
    );

    return NextResponse.json({
      success: true,
      discovered: matched.length,
      total_sheet_rows: dataRows.length,
      grouped_creators: grouped.length,
      inserted,
      warnings,
    });
  } catch (e) {
    console.error('Discovery scan error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

async function upsertBatch(creators: MatchedCreator[], campaignId: string, userId: string) {
  const now = new Date().toISOString();

  // Process 10 creators at a time in parallel
  for (let i = 0; i < creators.length; i += 10) {
    const batch = creators.slice(i, i + 10);
    await Promise.all(batch.map(async (creator) => {
      const creatorUuid = uuidv5(creator.creator_id, CREATOR_UUID_NAMESPACE);

      // 1. Insert creator (ignore if exists), then update
      const creatorParams = [
        creatorUuid,
        creator.creator_name,
        creator.creator_channel || creator.platforms[0]?.platform_username || null,
        creator.primary_topics,
        creator.primary_language ? [creator.primary_language] : [],
        creator.country ? [creator.country] : [],
        creator.active_status ? creator.active_status.toLowerCase() !== 'active' : false,
        creator.last_active_at || null,
        now,
      ];
      await dbQuery(
        `INSERT INTO ${t('creators')} (id, display_name, primary_handle, topics, languages, geo_focus, is_dormant, last_content_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         ON CONFLICT DO NOTHING`,
        creatorParams
      );
      await dbQuery(
        `UPDATE ${t('creators')} SET display_name=$2, primary_handle=$3, topics=$4, languages=$5, geo_focus=$6, is_dormant=$7, last_content_date=$8, updated_at=$9 WHERE id=$1`,
        creatorParams
      );

      // 2. Insert platform account
      const plat = creator.platforms[0];
      if (plat?.platform_url) {
        await dbQuery(
          `INSERT INTO ${t('creator_platform_accounts')} (id, creator_id, platform, handle, url, follower_count, metrics_json, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, $7)
           ON CONFLICT DO NOTHING`,
          [creatorUuid, plat.platform, plat.platform_username || null, plat.platform_url, plat.follower_count, JSON.stringify(plat.metrics), now]
        );
      }

      // 3. Link to campaign
      await dbQuery(
        `INSERT INTO ${t('campaign_creators')} (id, campaign_id, creator_id, added_by_user_id, pipeline_stage, ingestion_status, scoring_status, outreach_state, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'discovered', 'not_started', 'not_scored', 'not_started', $4, $5)
         ON CONFLICT DO NOTHING`,
        [campaignId, creatorUuid, userId, now, now]
      );
    }));
  }
}
