import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, isAnthropicConfigured } from '@/lib/anthropic';
import { dbQuery, t } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { campaign_creator_id, angle_id, user_id } = await req.json();

  const ctxRes = await dbQuery<{
    creator_name: string; campaign_name: string; campaign_brief: string;
    primary_handle: string; outreach_packet_id: string | null;
  }>(`
    SELECT c.display_name as creator_name, camp.name as campaign_name,
      camp.creative_brief as campaign_brief, c.primary_handle,
      op.id as outreach_packet_id
    FROM ${t('campaign_creators')} cc
    JOIN ${t('creators')} c ON c.id = cc.creator_id
    JOIN ${t('campaigns')} camp ON camp.id = cc.campaign_id
    LEFT JOIN ${t('outreach_packets')} op ON op.campaign_creator_id = cc.id
    WHERE cc.id = $1
  `, [campaign_creator_id]);

  const ctx = ctxRes.data[0];
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let angleContext = '';
  let finalAngleId = angle_id;

  if (angle_id) {
    const angRes = await dbQuery<{ title: string; format: string; key_points_json: string[] }>(
      `SELECT title, format, key_points_json FROM ${t('content_angles')} WHERE id = $1`, [angle_id]
    );
    if (angRes.data[0]) {
      const a = angRes.data[0];
      angleContext = `\nAngle: "${a.title}" (${a.format})\nKey points: ${(Array.isArray(a.key_points_json) ? a.key_points_json : []).join(', ')}`;
    }
  } else {
    const angRes = await dbQuery<{ id: string; title: string; format: string; key_points_json: string[] }>(`
      SELECT ca.id, ca.title, ca.format, ca.key_points_json
      FROM ${t('content_angles')} ca
      JOIN ${t('creator_evaluations')} ce ON ce.id = ca.evaluation_id
      WHERE ce.campaign_creator_id = $1 AND ca.selected_for_outreach = true LIMIT 1
    `, [campaign_creator_id]);
    if (angRes.data[0]) {
      finalAngleId = angRes.data[0].id;
      const a = angRes.data[0];
      angleContext = `\nAngle: "${a.title}" (${a.format})\nKey points: ${(Array.isArray(a.key_points_json) ? a.key_points_json : []).join(', ')}`;
    }
  }

  const now = new Date().toISOString();
  let subject: string;
  let bodyMd: string;

  const followupPlan = [
    { channel: 'email', day: 2, action: 'Follow-up email if no reply', done: false },
    { channel: 'linkedin', day: 2, action: 'LinkedIn connection request with brief note', done: false },
    { channel: 'email', day: 5, action: 'Second follow-up referencing specific video', done: false },
    { channel: 'linkedin', day: 5, action: 'LinkedIn follow-up message', done: false },
    { channel: 'email', day: 9, action: 'Final follow-up + close loop', done: false },
    { channel: 'x', day: 5, action: 'Optional: engage with recent post', done: false },
  ];

  if (!isAnthropicConfigured()) {
    subject = `${ctx.campaign_name} x ${ctx.creator_name}: Collaboration Opportunity`;
    bodyMd = `Hi ${ctx.creator_name},\n\nI came across your content and think there's a great fit for a collaboration.\n\nWe're running a campaign for ${ctx.campaign_name} and your audience aligns well with our goals.${angleContext ? `\n\nWe think the angle **"${angleContext}"** would work well.\n` : ''}\n\nWould you be open to a quick call to explore?\n\nBest,\n[Your name]\n\n> _Configure ANTHROPIC_API_KEY for AI-personalized outreach drafts._`;
  } else {
    const client = getAnthropicClient();
    const prompt = `Write a personalized B2B creator outreach email.

CAMPAIGN: ${ctx.campaign_name}
BRIEF: ${ctx.campaign_brief?.slice(0, 500)}
CREATOR: ${ctx.creator_name} (${ctx.primary_handle || 'YouTube'})
${angleContext}

Write 150-200 words. Professional but warm. Reference their specific content. Clear CTA for a 20-min call. End with [Your name].
Return JSON: {"subject": "...", "body_md": "..."}`;

    const msg = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const parsed = JSON.parse(text.trim());
    subject = parsed.subject;
    bodyMd = parsed.body_md;
  }

  if (ctx.outreach_packet_id) {
    await dbQuery(
      `UPDATE ${t('outreach_packets')} SET subject=$1, body_md=$2, selected_angle_id=$3, followup_plan_json=$4::jsonb, last_updated_at=$5 WHERE id=$6`,
      [subject, bodyMd, finalAngleId || null, JSON.stringify(followupPlan), now, ctx.outreach_packet_id]
    );
  } else {
    await dbQuery(
      `INSERT INTO ${t('outreach_packets')} (campaign_creator_id, created_by_user_id, subject, body_md, selected_angle_id, followup_plan_json, last_updated_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
      [campaign_creator_id, user_id || 'a0000001-0000-0000-0000-000000000002', subject, bodyMd, finalAngleId || null, JSON.stringify(followupPlan), now, now]
    );
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET outreach_state='drafted', updated_at=$1 WHERE id=$2 AND outreach_state='not_started'`,
      [now, campaign_creator_id]
    );
  }

  return NextResponse.json({ ok: true, subject, body_md: bodyMd, followup_plan: followupPlan });
}
