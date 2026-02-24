import { NextRequest, NextResponse } from 'next/server'
import { aiGenerateOutreachDraft } from '@/lib/ai-actions'
import { dbQuery } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { campaign_creator_id, campaign_id, created_by_user_id } = await req.json()

    // Fetch all needed context
    const [ccRes, campaignRes] = await Promise.all([
      dbQuery(
        `SELECT cc.*, cr.display_name, cr.bio,
           ARRAY(SELECT url FROM creator_platform_accounts WHERE creator_id = cr.id) as platform_urls
         FROM campaign_creators cc
         JOIN creators cr ON cr.id = cc.creator_id
         WHERE cc.id = $1`,
        [campaign_creator_id]
      ),
      dbQuery(
        `SELECT c.*, cl.name as client_name FROM campaigns c JOIN clients cl ON cl.id = c.client_id WHERE c.id = $1`,
        [campaign_id]
      ),
    ])

    if (!ccRes.data.length || !campaignRes.data.length) {
      return NextResponse.json({ error: 'Campaign creator or campaign not found' }, { status: 404 })
    }

    const cc = ccRes.data[0] as Record<string, unknown>
    const campaign = campaignRes.data[0] as Record<string, unknown>

    // Get evaluation and evidence
    const evalRes = await dbQuery(
      `SELECT ce.*, ca.title as angle_title, ca.format as angle_format, ca.key_points_json
       FROM creator_evaluations ce
       LEFT JOIN content_angles ca ON ca.evaluation_id = ce.id AND ca.selected_for_outreach = true
       WHERE ce.campaign_creator_id = $1`,
      [campaign_creator_id]
    )

    const snippetsRes = await dbQuery(
      `SELECT es.*, ci.url as content_url
       FROM evidence_snippets es
       JOIN creator_evaluations ce ON ce.id = es.evaluation_id
       JOIN content_items ci ON ci.id = es.content_item_id
       WHERE ce.campaign_creator_id = $1
       LIMIT 5`,
      [campaign_creator_id]
    )

    const evalData = evalRes.data[0] as Record<string, unknown> | undefined
    const angle = evalData ? {
      title: evalData.angle_title as string,
      format: evalData.angle_format as string,
      key_points: (evalData.key_points_json as string[]) || [],
    } : null

    const draft = await aiGenerateOutreachDraft({
      campaignName: campaign.name as string,
      campaignBrief: campaign.creative_brief as string,
      creatorName: cc.display_name as string,
      platforms: (cc.platform_urls as string[]) || [],
      selectedAngle: angle,
      evidenceSnippets: snippetsRes.data.map(s => {
        const snippet = s as Record<string, unknown>
        return {
          quote: snippet.quote as string,
          url: snippet.content_url as string,
          why_it_matters: snippet.why_it_matters as string,
        }
      }),
    })

    // Upsert outreach packet
    const existingPacket = await dbQuery(
      `SELECT id FROM outreach_packets WHERE campaign_creator_id = $1`,
      [campaign_creator_id]
    )

    if (existingPacket.data.length) {
      await dbQuery(
        `UPDATE outreach_packets SET subject=$1, body_md=$2, followup_plan_json=$3, last_updated_at=now() WHERE campaign_creator_id=$4`,
        [draft.subject, draft.body_md, JSON.stringify(draft.followup_plan), campaign_creator_id]
      )
    } else {
      await dbQuery(
        `INSERT INTO outreach_packets (id, campaign_creator_id, created_by_user_id, subject, body_md, followup_plan_json, last_updated_at, created_at)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,now(),now())`,
        [campaign_creator_id, created_by_user_id, draft.subject, draft.body_md, JSON.stringify(draft.followup_plan)]
      )
    }

    // Update outreach state
    await dbQuery(
      `UPDATE campaign_creators SET outreach_state='drafted', updated_at=now() WHERE id=$1`,
      [campaign_creator_id]
    )

    return NextResponse.json(draft)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
