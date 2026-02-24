'use server'

import { callAIApi } from './db'

const API_BASE = 'https://builder-api.staging.empromptu.ai'

async function setupPrompt(name: string, variables: string[], text: string) {
  await callAIApi('/setup_ai_prompt', {
    prompt_name: name,
    input_variables: variables,
    prompt_text: text,
  })
}

async function applyPrompt(name: string, inputData: Record<string, string>, returnType: string) {
  const result = await callAIApi('/apply_prompt_to_data', {
    prompt_name: name,
    input_data: { ...inputData, return_type: returnType },
  }) as { value: unknown }
  return result.value
}

// ---- AI: Suggest Topics ----
export async function aiSuggestTopics(brief: string): Promise<Array<{
  topic: string; confidence: number; rationale: string
}>> {
  try {
    await setupPrompt(
      'suggest_campaign_topics',
      ['creative_brief'],
      `You are a creator ops strategist. Analyze this campaign creative brief and suggest up to 5 content topics that would resonate with technical creators.

Creative brief: {creative_brief}

Return a JSON array with exactly this format (no markdown, no extra text):
[{"topic":"...", "confidence":0.0, "rationale":"One sentence explaining why this topic fits."}]

Rules:
- 3-5 topics maximum
- confidence is 0.0 to 1.0
- Be specific and technical, not generic
- Topics should map to real YouTube search intent`
    )

    const raw = await applyPrompt('suggest_campaign_topics', { creative_brief: brief }, 'raw_text') as string
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed.slice(0, 5)
    return []
  } catch (e) {
    console.error('aiSuggestTopics error:', e)
    return [
      { topic: 'Kubernetes cost optimization', confidence: 0.95, rationale: 'Core use case for the campaign product category.' },
      { topic: 'FinOps for platform engineers', confidence: 0.88, rationale: 'Primary ICP overlap between product and audience.' },
      { topic: 'OpenTelemetry cost attribution', confidence: 0.82, rationale: 'Technical differentiator that resonates with observability-focused creators.' },
    ]
  }
}

// ---- AI: Generate 15 Search Terms ----
export async function aiGenerateSearchTerms(
  brief: string,
  topics: string[],
  personas: string[],
  productCategory: string
): Promise<Array<{
  term: string;
  category_tag: string;
  why_it_helps: string;
}>> {
  try {
    await setupPrompt(
      'generate_search_terms',
      ['campaign_brief', 'topics', 'personas', 'product_category'],
      `You are a YouTube creator research specialist. Generate EXACTLY 15 YouTube search terms for a creator outreach campaign.

Campaign brief: {campaign_brief}
Topics: {topics}
Personas: {personas}
Product category: {product_category}

Return a JSON array with EXACTLY 15 objects, no more, no less:
[{"term":"...","category_tag":"...","why_it_helps":"1-2 sentence explanation."}]

category_tag must be one of: product_category, competitor, implementation, problem_solution, integration, programming_language, tutorial_format

Rules:
- EXACTLY 15 terms
- Each term should be a real YouTube search query
- Mix the 7 category types
- why_it_helps must be 1-2 sentences
- Target technical audiences matching the personas
- No duplicate themes`
    )

    const raw = await applyPrompt('generate_search_terms', {
      campaign_brief: brief,
      topics: topics.join(', '),
      personas: personas.join(', '),
      product_category: productCategory,
    }, 'raw_text') as string
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length === 15) return parsed
    if (Array.isArray(parsed)) return parsed.slice(0, 15)
    return []
  } catch (e) {
    console.error('aiGenerateSearchTerms error:', e)
    return []
  }
}

// ---- AI: Score Creator ----
export async function aiScoreCreator(params: {
  campaignBrief: string;
  topics: string[];
  personas: string[];
  promptGaps: string[];
  creatorName: string;
  creatorBio: string;
  platforms: string[];
  contentItems: Array<{
    id: string;
    title: string;
    url: string;
    platform: string;
    raw_text: string;
    view_count?: number;
  }>;
}): Promise<{
  overall_score: number;
  score_technical_relevance: number;
  score_audience_alignment: number;
  score_content_quality: number;
  score_channel_performance: number;
  score_brand_fit: number;
  strengths: Array<{ text: string; content_item_id: string; quote: string }>;
  weaknesses: Array<{ text: string }>;
  rationale_md: string;
  evidence_snippets: Array<{
    content_item_id: string;
    timestamp_start_seconds: number | null;
    timestamp_end_seconds: number | null;
    quote: string;
    dimension: string;
    why_it_matters: string;
  }>;
  content_angles: Array<{
    title: string;
    format: string;
    persona: string;
    key_points: string[];
  }>;
  needs_manual_review: boolean;
  needs_manual_review_reason: string | null;
  evidence_coverage: string;
}> {
  const contentSummary = params.contentItems.map(ci => `
--- Content Item (id: ${ci.id}) ---
Title: ${ci.title}
URL: ${ci.url}
Platform: ${ci.platform}
Views: ${ci.view_count || 'N/A'}
Text (first 2000 chars): ${ci.raw_text.substring(0, 2000)}
`).join('\n')

  try {
    await setupPrompt(
      'score_creator',
      ['campaign_context', 'creator_profile', 'content_items_text'],
      `You are a creator evaluation specialist with deep expertise in technical content and FinOps.

Campaign context: {campaign_context}

Creator profile: {creator_profile}

Ingested content: {content_items_text}

Evaluate this creator using the rubric below. Return ONLY valid JSON, no markdown.

RUBRIC WEIGHTS:
- technical_relevance: 30%
- audience_alignment: 25%
- content_quality: 20%
- channel_performance: 15%
- brand_fit: 10%

CRITICAL RULE: Every evidence quote MUST be an exact substring from the content text provided above. Do not paraphrase. Extract verbatim.

Return this exact JSON structure:
{
  "overall_score": 0,
  "score_technical_relevance": 0,
  "score_audience_alignment": 0,
  "score_content_quality": 0,
  "score_channel_performance": 0,
  "score_brand_fit": 0,
  "strengths": [{"text":"...","content_item_id":"...","quote":"exact verbatim quote"}],
  "weaknesses": [{"text":"..."}],
  "rationale_md": "## Evaluation Summary\\n\\n...",
  "evidence_snippets": [
    {
      "content_item_id": "...",
      "timestamp_start_seconds": null,
      "timestamp_end_seconds": null,
      "quote": "exact verbatim quote from content",
      "dimension": "technical_relevance",
      "why_it_matters": "..."
    }
  ],
  "content_angles": [
    {
      "title": "...",
      "format": "tutorial",
      "persona": "...",
      "key_points": ["...", "..."]
    }
  ]
}`
    )

    const raw = await applyPrompt('score_creator', {
      campaign_context: `Brief: ${params.campaignBrief}\nTopics: ${params.topics.join(', ')}\nPersonas: ${params.personas.join(', ')}\nPrompt gaps: ${params.promptGaps.join('; ')}`,
      creator_profile: `Name: ${params.creatorName}\nBio: ${params.creatorBio}\nPlatforms: ${params.platforms.join(', ')}`,
      content_items_text: contentSummary,
    }, 'raw_text') as string

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Evidence validation: verify every quote is an exact substring of its content item's raw_text
    const contentMap = new Map(params.contentItems.map(ci => [ci.id, ci.raw_text]))
    let failedQuotes: string[] = []

    for (const snippet of (parsed.evidence_snippets || [])) {
      const raw_text = contentMap.get(snippet.content_item_id)
      if (raw_text && !raw_text.includes(snippet.quote)) {
        failedQuotes.push(`Quote not found in content ${snippet.content_item_id}: "${snippet.quote.substring(0, 80)}..."`)
      }
    }

    // Compute overall score from weighted dimensions
    const overall = Math.round(
      parsed.score_technical_relevance * 0.30 +
      parsed.score_audience_alignment * 0.25 +
      parsed.score_content_quality * 0.20 +
      parsed.score_channel_performance * 0.15 +
      parsed.score_brand_fit * 0.10
    )

    // Compute evidence coverage
    const validSnippets = (parsed.evidence_snippets || []).filter((s: { content_item_id: string; quote: string }) => {
      const rt = contentMap.get(s.content_item_id)
      return rt && rt.includes(s.quote)
    })
    const uniqueItems = new Set(validSnippets.map((s: { content_item_id: string }) => s.content_item_id)).size
    const uniqueDims = new Set(validSnippets.map((s: { dimension: string }) => s.dimension)).size
    let evidence_coverage = 'none'
    if (validSnippets.length >= 6 && uniqueItems >= 3 && uniqueDims >= 3) evidence_coverage = 'strong'
    else if (validSnippets.length >= 3 && uniqueItems >= 2 && uniqueDims >= 2) evidence_coverage = 'medium'
    else if (validSnippets.length >= 1) evidence_coverage = 'weak'

    const needs_manual_review = failedQuotes.length > 0
    const needs_manual_review_reason = failedQuotes.length > 0
      ? `Evidence validation failed: ${failedQuotes.join('; ')}`
      : null

    return {
      ...parsed,
      overall_score: overall,
      needs_manual_review,
      needs_manual_review_reason,
      evidence_coverage,
    }
  } catch (e) {
    console.error('aiScoreCreator error:', e)
    throw new Error(`Scoring failed: ${(e as Error).message}`)
  }
}

// ---- AI: Generate Outreach Draft ----
export async function aiGenerateOutreachDraft(params: {
  campaignName: string;
  campaignBrief: string;
  creatorName: string;
  platforms: string[];
  selectedAngle: { title: string; format: string; key_points: string[] } | null;
  evidenceSnippets: Array<{ quote: string; url: string; why_it_matters: string }>;
}): Promise<{
  subject: string;
  body_md: string;
  followup_plan: Array<{
    channel: string; label: string; day_offset: number; completed: boolean
  }>;
}> {
  try {
    await setupPrompt(
      'generate_outreach_draft',
      ['campaign_context', 'creator_info', 'angle_info', 'evidence_info'],
      `You are a creator partnerships specialist writing a first outreach email.

Campaign: {campaign_context}
Creator: {creator_info}
Proposed content angle: {angle_info}
Evidence supporting the pitch: {evidence_info}

Write a compelling, personal outreach email. Rules:
- Subject line: concise, specific, value-forward (no clickbait)
- Body: 150-200 words max
- Reference specific content from the creator (use the evidence quotes)
- Clearly state what you're proposing
- End with a soft CTA (call, reply, etc.)
- Tone: professional but warm, NOT sales-y
- CRITICAL: Do NOT include any send/automation instructions. This is draft-only.

Return ONLY valid JSON:
{
  "subject": "...",
  "body_md": "...",
  "followup_plan": [
    {"channel":"email","label":"Follow-up email","day_offset":2,"completed":false},
    {"channel":"email","label":"Second follow-up","day_offset":5,"completed":false},
    {"channel":"email","label":"Final email","day_offset":9,"completed":false},
    {"channel":"linkedin","label":"LinkedIn connection","day_offset":2,"completed":false},
    {"channel":"linkedin","label":"LinkedIn follow-up","day_offset":5,"completed":false},
    {"channel":"x","label":"X mention (optional)","day_offset":5,"completed":false}
  ]
}`
    )

    const raw = await applyPrompt('generate_outreach_draft', {
      campaign_context: `Campaign: ${params.campaignName}\n${params.campaignBrief.substring(0, 500)}`,
      creator_info: `Creator: ${params.creatorName}\nPlatforms: ${params.platforms.join(', ')}`,
      angle_info: params.selectedAngle
        ? `Title: ${params.selectedAngle.title}\nFormat: ${params.selectedAngle.format}\nKey points: ${params.selectedAngle.key_points.join(', ')}`
        : 'No specific angle selected',
      evidence_info: params.evidenceSnippets.map(e => `Quote: "${e.quote}" â ${e.why_it_matters}`).join('\n'),
    }, 'raw_text') as string

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch (e) {
    console.error('aiGenerateOutreachDraft error:', e)
    throw new Error(`Outreach draft generation failed: ${(e as Error).message}`)
  }
}

// ---- Stub: YouTube Search ----
export function stubYoutubeSearch(term: string): Array<{
  channelName: string; channelUrl: string; subscriberCount: number; lastVideoDate: string; topics: string[]
}> {
  return [
    { channelName: `Creator for "${term}"`, channelUrl: `https://youtube.com/@creator-stub`, subscriberCount: 15000, lastVideoDate: '2026-01-15', topics: [term] },
  ]
}

// ---- Stub: Reddit Fetch ----
export function stubRedditFetch(subreddits: string[], keywords: string[]): Array<{
  title: string; url: string; subreddit: string; karma: number; comment_count: number; reddit_post_id: string;
}> {
  return subreddits.flatMap(sr =>
    keywords.map((kw, i) => ({
      title: `[Stub] ${kw} discussion in r/${sr}`,
      url: `https://reddit.com/r/${sr}/comments/stub_${i}_${Date.now()}`,
      subreddit: sr,
      karma: Math.floor(Math.random() * 500) + 50,
      comment_count: Math.floor(Math.random() * 80) + 5,
      reddit_post_id: `stub_${sr}_${i}_${Date.now()}`,
    }))
  )
}
