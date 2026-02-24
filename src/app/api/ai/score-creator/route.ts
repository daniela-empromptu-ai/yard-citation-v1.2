import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, isAnthropicConfigured } from '@/lib/anthropic';
import { dbQuery, t } from '@/lib/db';
import { validateEvidenceQuotes } from '@/lib/evidence-validation';

export async function POST(req: NextRequest) {
  const { campaign_creator_id } = await req.json();

  if (!campaign_creator_id) {
    return NextResponse.json({ error: 'campaign_creator_id required' }, { status: 400 });
  }

  const ccRes = await dbQuery<{
    cc_id: string; campaign_id: string; creator_id: string;
    creator_name: string; bio: string; topics: string[]; languages: string[];
    is_dormant: boolean; is_autodubbed_suspected: boolean; competitor_affiliated: boolean;
    campaign_brief: string; product_category: string; personas: string; prompt_gaps: string;
  }>(`
    SELECT cc.id as cc_id, cc.campaign_id, cc.creator_id,
      c.display_name as creator_name, c.bio, c.topics, c.languages,
      c.is_dormant, c.is_autodubbed_suspected, c.competitor_affiliated,
      camp.creative_brief as campaign_brief, camp.product_category,
      (SELECT string_agg(persona_name, ', ') FROM ${t('campaign_personas')} WHERE campaign_id = camp.id) as personas,
      (SELECT string_agg(prompt_text, ' | ') FROM ${t('campaign_prompt_gaps')} WHERE campaign_id = camp.id AND status = 'approved') as prompt_gaps
    FROM ${t('campaign_creators')} cc
    JOIN ${t('creators')} c ON c.id = cc.creator_id
    JOIN ${t('campaigns')} camp ON camp.id = cc.campaign_id
    WHERE cc.id = $1
  `, [campaign_creator_id]);

  if (!ccRes.success || ccRes.data.length === 0) {
    return NextResponse.json({ error: 'Campaign creator not found' }, { status: 404 });
  }

  const ctx = ccRes.data[0];
  const ciRes = await dbQuery<{ id: string; title: string; url: string; platform: string; raw_text: string; metadata_json: Record<string, unknown>; published_at: string }>(
    `SELECT id, title, url, platform, raw_text, metadata_json, published_at FROM ${t('content_items')} WHERE creator_id = $1 AND campaign_id = $2 ORDER BY published_at DESC LIMIT 10`,
    [ctx.creator_id, ctx.campaign_id]
  );

  const contentItems = ciRes.data;

  if (contentItems.length === 0) {
    return NextResponse.json({ error: 'No content items found. Please ingest content first.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  let scoringResult: {
    overall_score: number; score_technical_relevance: number; score_audience_alignment: number;
    score_content_quality: number; score_channel_performance: number; score_brand_fit: number;
    strengths: string[]; weaknesses: string[]; rationale_md: string;
    evidence_snippets: Array<{ content_item_id: string; quote: string; dimension: string; why_it_matters: string; timestamp_start_seconds?: number }>;
    content_angles: Array<{ title: string; format: string; persona?: string; key_points: string[] }>;
  };

  if (!isAnthropicConfigured()) {
    scoringResult = {
      overall_score: 75, score_technical_relevance: 78, score_audience_alignment: 74,
      score_content_quality: 76, score_channel_performance: 70, score_brand_fit: 73,
      strengths: ['Relevant technical content on Kubernetes topics', 'Good audience alignment with target personas'],
      weaknesses: ['Limited evidence available (stub mode)', 'Configure ANTHROPIC_API_KEY for real scoring'],
      rationale_md: '## Stub Evaluation\n\nConfigure `ANTHROPIC_API_KEY` for real AI-powered scoring with evidence validation.',
      evidence_snippets: contentItems.slice(0, 2).map(ci => ({
        content_item_id: ci.id,
        quote: ci.raw_text.slice(0, 80).trim(),
        dimension: 'technical_relevance',
        why_it_matters: 'Stub evidence â configure AI for real evidence extraction.',
      })),
      content_angles: [
        { title: 'Kubernetes Cost Optimization Tutorial', format: 'tutorial', persona: 'DevOps Lead', key_points: ['Introduction', 'Implementation', 'Results'] },
      ],
    };
  } else {
    const client = getAnthropicClient();
    const contentSummary = contentItems.map((ci, i) =>
      `[${i+1}] ID: ${ci.id}\nTitle: ${ci.title}\nURL: ${ci.url}\nContent:\n${ci.raw_text.slice(0, 1500)}`
    ).join('\n\n---\n\n');

    const prompt = `Score this creator for campaign fit. Return ONLY valid JSON.

CAMPAIGN: ${ctx.campaign_brief?.slice(0, 800)}
PERSONAS: ${ctx.personas || 'Platform Engineer, DevOps Lead'}
CREATOR: ${ctx.creator_name}
CONTENT (${contentItems.length} items):
${contentSummary}

RUBRIC: technical_relevance 30%, audience_alignment 25%, content_quality 20%, channel_performance 15%, brand_fit 10%

CRITICAL: Every evidence quote MUST be an exact substring from the provided content above.

Return JSON:
{
  "overall_score": 0,
  "score_technical_relevance": 0,
  "score_audience_alignment": 0,
  "score_content_quality": 0,
  "score_channel_performance": 0,
  "score_brand_fit": 0,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "rationale_md": "## Summary\\n...",
  "evidence_snippets": [{"content_item_id":"id","quote":"exact text","dimension":"technical_relevance","why_it_matters":"...","timestamp_start_seconds":null}],
  "content_angles": [{"title":"...","format":"tutorial","persona":"...","key_points":["..."]}]
}`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    scoringResult = JSON.parse(text.trim());
  }

  // Validate evidence
  const snippetsForValidation = (scoringResult.evidence_snippets || []).map(es => {
    const ci = contentItems.find(c => c.id === es.content_item_id);
    return { quote: es.quote, content_item_id: es.content_item_id, raw_text: ci?.raw_text || '' };
  });
  const validation = validateEvidenceQuotes(snippetsForValidation);
  const needsManualReview = !validation.valid;
  const nmrReason = needsManualReview
    ? `Evidence validation failed: ${validation.failures.slice(0, 2).map(f => f.reason).join('; ')}`
    : null;

  const computedScore = Math.round(
    scoringResult.score_technical_relevance * 0.30 +
    scoringResult.score_audience_alignment * 0.25 +
    scoringResult.score_content_quality * 0.20 +
    scoringResult.score_channel_performance * 0.15 +
    scoringResult.score_brand_fit * 0.10
  );

  const uniqueItems = new Set(scoringResult.evidence_snippets?.map(e => e.content_item_id) || []);
  const uniqueDimensions = new Set(scoringResult.evidence_snippets?.map(e => e.dimension) || []);
  const sc = scoringResult.evidence_snippets?.length || 0;
  let coverage = 'none';
  if (sc >= 6 && uniqueItems.size >= 3 && uniqueDimensions.size >= 3) coverage = 'strong';
  else if (sc >= 3 && uniqueItems.size >= 2 && uniqueDimensions.size >= 2) coverage = 'medium';
  else if (sc >= 1) coverage = 'weak';

  await dbQuery(`DELETE FROM ${t('creator_evaluations')} WHERE campaign_creator_id = $1`, [campaign_creator_id]);

  const evalRes = await dbQuery<{ id: string }>(
    `INSERT INTO ${t('creator_evaluations')} (campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, needs_manual_review_reason, overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit, strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
     VALUES ($1,'anthropic','claude-3-5-sonnet-20241022',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16) RETURNING id`,
    [campaign_creator_id, now, coverage, needsManualReview, nmrReason, computedScore,
     scoringResult.score_technical_relevance, scoringResult.score_audience_alignment, scoringResult.score_content_quality,
     scoringResult.score_channel_performance, scoringResult.score_brand_fit,
     JSON.stringify(scoringResult.strengths || []), JSON.stringify(scoringResult.weaknesses || []),
     scoringResult.rationale_md || '', now, now]
  );

  const evalId = evalRes.data[0]?.id;
  if (evalId) {
    for (const es of (scoringResult.evidence_snippets || [])) {
      await dbQuery(
        `INSERT INTO ${t('evidence_snippets')} (evaluation_id, content_item_id, quote, dimension, why_it_matters, timestamp_start_seconds, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [evalId, es.content_item_id, es.quote, es.dimension, es.why_it_matters, es.timestamp_start_seconds || null, now]
      );
    }
    for (const angle of (scoringResult.content_angles || [])) {
      await dbQuery(
        `INSERT INTO ${t('content_angles')} (evaluation_id, title, format, persona, key_points_json, created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
        [evalId, angle.title, angle.format, angle.persona || null, JSON.stringify(angle.key_points || []), now]
      );
    }
    const newStage = needsManualReview ? 'needs_manual_review' : 'scored';
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET scoring_status='scored', pipeline_stage=$1, updated_at=$2 WHERE id=$3`,
      [newStage, now, campaign_creator_id]
    );
    await dbQuery(
      `INSERT INTO ${t('activity_log')} (campaign_id, creator_id, campaign_creator_id, event_type, event_data_json, created_at)
       SELECT cc.campaign_id, cc.creator_id, $1, 'evaluation_completed', $2::jsonb, $3
       FROM ${t('campaign_creators')} cc WHERE cc.id = $1`,
      [campaign_creator_id, JSON.stringify({ score: computedScore, coverage, needs_manual_review: needsManualReview }), now]
    );
  }

  return NextResponse.json({ ok: true, evaluation_id: evalId, overall_score: computedScore, evidence_coverage: coverage, needs_manual_review: needsManualReview });
}
