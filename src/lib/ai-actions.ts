'use server'

import { callAIApi } from './db'
import JSON5 from 'json5'

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
      `You are a creator research specialist who finds technical content creators for B2B campaigns. Generate EXACTLY 15 search terms that will be used to match against a database of creators' self-described content topics via substring matching.

Campaign creative brief: {campaign_brief}
Campaign topics: {topics}
Target personas: {personas}
Product category: {product_category}

MATCHING CONTEXT:
These terms will be matched against how creators label their own content areas (e.g. "Kubernetes", "DevOps", "cloud cost optimization"). A match happens when the term appears as a substring in the creator's topic list, or the creator's topic appears as a substring of the term. Generate terms that reflect how creators self-categorize their content, not how end-users search YouTube.

RULES:
- EXACTLY 15 terms
- Include common synonyms and abbreviations as separate terms (e.g. both "Kubernetes" and "K8s", both "CI/CD" and "continuous integration")
- Mix of breadth levels:
  - 3-4 broad terms (wide net, e.g. "cloud infrastructure")
  - 6-8 medium terms (e.g. "Kubernetes cost management")
  - 3-4 specific/niche terms (e.g. "OpenCost Prometheus integration")
- Include 2-3 competitor or adjacent-product terms relevant to the product category
- Consider audience maturity: match the technical depth level of the target personas
- category_tag must be one of: product_category, competitor, implementation, problem_solution, integration, programming_language, tutorial_format
- why_it_helps must be 1-2 sentences explaining what kind of creator this term finds
- No duplicate or near-duplicate terms

Return a JSON array with EXACTLY 15 objects, no more, no less:
[{"term":"...","category_tag":"...","why_it_helps":"..."}]`
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

// ---- AI: Generate Search Terms from Categories (standalone, no campaign) ----
export async function aiGenerateSearchTermsFromCategories(
  categories: string[]
): Promise<string[]> {
  try {
    await setupPrompt(
      'generate_search_terms_from_categories',
      ['categories'],
      `You are a creator discovery specialist. Given content categories, generate EXACTLY 15 YouTube search terms that will find independent technical content creators in these areas.

Categories: {categories}

RULES:
- EXACTLY 15 terms
- Terms should be YouTube video search queries (what a viewer would type, e.g. "kubernetes production cost optimization" not just "kubernetes")
- Mix of breadth: 4-5 broad terms, 6-7 medium, 3-4 niche
- Include common synonyms and abbreviations as separate terms (e.g. both "kubernetes" and "k8s")
- Focus on terms that surface INDEPENDENT creators who share real-world experience, not vendor/company channels
- No duplicate or near-duplicate terms

Return ONLY a JSON array of strings, no objects, no explanation:
["term1", "term2", ...]`
    )

    const raw = await applyPrompt('generate_search_terms_from_categories', {
      categories: categories.join(', '),
    }, 'raw_text') as string
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed.slice(0, 15) as string[]
    return []
  } catch (e) {
    console.error('aiGenerateSearchTermsFromCategories error:', e)
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
Text (first 3000 chars): ${ci.raw_text.substring(0, 3000)}
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

TIMESTAMP RULE: For YouTube content where text is prefixed with [M:SS] timestamps, set timestamp_start_seconds to the total seconds value of the [M:SS] timestamp nearest to the beginning of the quoted text. For example, [3:42] → 222 seconds.

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

    let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = parseAIJson(cleaned)

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
      evidence_info: params.evidenceSnippets.map(e => `Quote: "${e.quote}" — ${e.why_it_matters}`).join('\n'),
    }, 'raw_text') as string

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch (e) {
    console.error('aiGenerateOutreachDraft error:', e)
    throw new Error(`Outreach draft generation failed: ${(e as Error).message}`)
  }
}

// ---- AI: Discover Look-alike Creators ----
export async function aiDiscoverCreators(params: {
  brief: string;
  topics: string[];
  personas: string[];
  gumshoeNotes: string;
  seedCreators: Array<{ name: string; platform: string; handle: string }>;
  existingHandles: Set<string>;
  count?: number;
}): Promise<Array<{
  name: string;
  platform: string;
  handle: string;
  url: string;
  why: string;
  suggested_categories: string[];
}>> {
  const seedList = params.seedCreators.length > 0
    ? params.seedCreators.map(c => `${c.name} (${c.platform}: ${c.handle})`).join('\n')
    : 'None provided';

  const n = params.count || 20;

  try {
    await setupPrompt(
      'discover_lookalike_creators',
      ['campaign_context', 'seed_creators', 'count'],
      `You are a creator discovery specialist who finds technical content creators for B2B campaigns. Based on the campaign context and optional seed creators, suggest new creators who would be a good fit.

Campaign context: {campaign_context}

Seed creators (examples of good fits): {seed_creators}

Suggest exactly {count} creators. For each creator, provide:
- name: The channel/brand name as it appears on the platform
- platform: MUST be one of: youtube, medium, devto (these are the ONLY platforms we support)
- handle: Their handle/username on that platform (e.g. @BretFisher for YouTube, @copyconstruct for Medium, ben for Dev.to)
- url: Full profile/channel URL
- why: 1-2 sentences explaining why they fit this campaign
- suggested_categories: 1-3 niche categories (e.g. "Kubernetes", "DevOps", "Cloud Cost Optimization")

EXCLUSION RULES — do NOT suggest any of these:
- Company/vendor-owned channels (e.g. AWS, HashiCorp, Microsoft, Google Cloud, IBM, Red Hat, Docker Inc, CNCF, GitLab, Datadog, New Relic, Splunk)
- Creators who haven't published in 2+ years
- Channels with primarily AI-generated or synthetic content
- Auto-dubbed/auto-translated content
- Lifestyle, vlog, or non-technical content creators
Only suggest independent technical content creators.

RULES:
- ONLY suggest creators on youtube, medium, or devto — no other platforms
- Only suggest REAL creators that actually exist on the specified platform
- Do NOT repeat any creator already in the seed list
- Mix of audience sizes: some large (100k+), some mid (10k-100k), some micro (1k-10k)
- Each suggestion must be a different person/channel
- Be specific — provide real handles and URLs you are confident about

Return ONLY a JSON array, no markdown:
[{"name":"...","platform":"...","handle":"...","url":"...","why":"...","suggested_categories":["...",".."]}]`
    );

    const raw = await applyPrompt('discover_lookalike_creators', {
      campaign_context: [
        `Brief: ${params.brief}`,
        `Topics: ${params.topics.join(', ')}`,
        `Personas: ${params.personas.join(', ')}`,
        params.gumshoeNotes ? `Gumshoe report: ${params.gumshoeNotes}` : '',
      ].filter(Boolean).join('\n'),
      seed_creators: seedList,
      count: String(n),
    }, 'raw_text') as string;

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    // Filter out creators already in DB (by platform+handle)
    return parsed.filter((c: { platform: string; handle: string }) => {
      const key = `${c.platform}:${(c.handle || '').toLowerCase().replace(/^@/, '')}`;
      return !params.existingHandles.has(key);
    });
  } catch (e) {
    console.error('aiDiscoverCreators error:', e);
    return [];
  }
}

// ─── Robust JSON parsing for AI responses ───

/**
 * Parse JSON from AI responses with layered fallbacks.
 * Layer 1: JSON.parse (strict)
 * Layer 2: JSON5.parse (handles trailing commas, single quotes, unescaped newlines, etc.)
 * Layer 3: Extract JSON object/array with regex + JSON5
 */
function parseAIJson(text: string): ReturnType<typeof JSON.parse> {
  // Layer 1: strict JSON
  try {
    return JSON.parse(text)
  } catch { /* continue */ }

  // Layer 2: JSON5 (lenient — handles most LLM quirks)
  try {
    return JSON5.parse(text)
  } catch { /* continue */ }

  // Layer 3: extract JSON object/array from surrounding text, then JSON5
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try { return JSON5.parse(objectMatch[0]) } catch { /* continue */ }
  }
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try { return JSON5.parse(arrayMatch[0]) } catch { /* continue */ }
  }

  // Layer 4: Truncated JSON recovery — extract score fields from incomplete JSON
  // The builder API sometimes truncates long responses mid-JSON
  const scoreFields = [
    'overall_score', 'score_technical_relevance', 'score_audience_alignment',
    'score_content_quality', 'score_channel_performance', 'score_brand_fit',
  ]
  const recovered: Record<string, unknown> = {}
  let hasScores = false
  for (const field of scoreFields) {
    const match = text.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)`))
    if (match) {
      recovered[field] = parseInt(match[1], 10)
      hasScores = true
    }
  }
  if (hasScores) {
    // Extract what text fields we can
    const rationaleMatch = text.match(/"rationale_md"\s*:\s*"((?:[^"\\]|\\.)*)/)
    if (rationaleMatch) recovered.rationale_md = rationaleMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')

    const strengthsMatch = text.match(/"strengths"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
    if (strengthsMatch) {
      try { recovered.strengths = JSON5.parse(`[${strengthsMatch[1]}]`) } catch { recovered.strengths = [] }
    }

    const weaknessesMatch = text.match(/"weaknesses"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
    if (weaknessesMatch) {
      try { recovered.weaknesses = JSON5.parse(`[${weaknessesMatch[1]}]`) } catch { recovered.weaknesses = [] }
    }

    recovered.evidence_snippets = []
    recovered.content_angles = []
    recovered.needs_manual_review = true
    recovered.needs_manual_review_reason = 'Recovered from truncated AI response'

    console.log(`[ai] Recovered truncated JSON with scores: ${JSON.stringify(Object.fromEntries(scoreFields.map(f => [f, recovered[f]])))}`)
    return recovered
  }

  throw new Error(`Failed to parse AI JSON response (tried JSON, JSON5, regex extraction). First 200 chars: ${text.slice(0, 200)}`)
}

// ---- Stub: YouTube Search ----
export async function stubYoutubeSearch(term: string): Promise<Array<{
  channelName: string; channelUrl: string; subscriberCount: number; lastVideoDate: string; topics: string[]
}>> {
  return [
    { channelName: `Creator for "${term}"`, channelUrl: `https://youtube.com/@creator-stub`, subscriberCount: 15000, lastVideoDate: '2026-01-15', topics: [term] },
  ]
}

// ---- Stub: Reddit Fetch ----
export async function stubRedditFetch(subreddits: string[], keywords: string[]): Promise<Array<{
  title: string; url: string; subreddit: string; karma: number; comment_count: number; reddit_post_id: string;
}>> {
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
