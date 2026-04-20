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

// ---- Shared: distribute a fixed character budget across content items ----
// 30,000 chars ≈ 7,500 tokens — comfortably within builder API input limits.
// Builder API input is truncated at ~70k chars total (per Andrew) — keep total well under that.
const TOTAL_CONTENT_BUDGET = 60_000
const MAX_CHARS_PER_ITEM = 40_000

function buildContentSummary(
  contentItems: Array<{ id: string; title: string; url: string; platform: string; raw_text: string; view_count?: number }>
): string {
  const charsPerItem = Math.min(MAX_CHARS_PER_ITEM, Math.floor(TOTAL_CONTENT_BUDGET / Math.max(1, contentItems.length)))
  return contentItems.map(ci => `
--- Content Item (id: ${ci.id}) ---
Title: ${ci.title}
URL: ${ci.url}
Platform: ${ci.platform}
Views: ${ci.view_count || 'N/A'}
Text: ${ci.raw_text.substring(0, charsPerItem)}
`).join('\n')
}

// ---- AI: Score Creator — Stage 1 (scores + rationale + strengths/weaknesses) ----
// Builder API caps output at 4096 tokens; evidence + content angles are generated
// lazily via aiEnrichEvaluation when a user opens a high-scoring creator's detail panel.
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
  verdict: 'strong_fit' | 'possible_fit' | 'weak_fit' | 'pass';
  fit_summary: string;
  standout_signals: Array<{ text: string }>;
  concerns: Array<{ text: string }>;
  needs_manual_review: boolean;
  needs_manual_review_reason: string | null;
}> {
  const contentSummary = buildContentSummary(params.contentItems)

  // TEMPORARY: setupPrompt call to register prompt in the code's app context.
  // The builder GUI runs in a separate workspace — prompts created there don't
  // propagate to this app_id. Remove once Andrew wires the GUI to this context.
  const promptText = `You are evaluating a technical content creator for a B2B sponsorship campaign. Your job is to judge fit — not to fill out a rubric.

Campaign context: {campaign_context}

Creator profile: {creator_profile}

Ingested content (titles + transcripts/articles): {content_items_text}

HOW TO THINK ABOUT FIT

A great creator for this campaign has three things going on:

1. Topical fit — their niche is adjacent to or overlapping with the campaign's problem space. Exact topic match is NOT required and should NOT heavily penalize the score. A CI/CD or DevOps creator is squarely in the adjacency zone for a code-review tool — their audience reviews PRs and cares about code quality pipelines. A Kubernetes creator, infrastructure automation creator, or general backend engineering creator are all valid. A crypto or mobile gaming creator is not. The absence of explicit product coverage is expected — that is what the sponsorship is for.

2. Practitioner signal — does their audience come to solve work problems, or to learn fundamentals? Tells of a practitioner audience: multi-repo work, enterprise patterns, production tooling, CLI/IDE workflows, "here's how I actually do X at my job." Anti-tells: "coding for beginners," "top 10 languages," exam prep, generic tutorials. Practitioner beats beginner for B2B every time.

3. Demonstration authenticity — real human on camera (not AI voiceover), hands-on in the tool (not talking-head commentary), original work (not aggregated/re-licensed conference talks). Production quality matters, but polish without a real person is a red flag.

TASTE NOTES (calibrate to these)

- Niche depth beats reach. A QA-specialist at 17K subscribers beats a general coding channel at 200K for a testing tool.
- Topical adjacency is fine — don't penalize a creator for not having already mentioned the campaign product. We expect the sponsorship to introduce it.
- AI voiceovers, aggregated conference content, tutorial-mill aesthetics (churn of "top 10" listicles with no demonstration) are hard rejects.
- Independent, practitioner-led channels are the target. Corporate channels, media aggregators, and founder-of-competitor channels may score on content but belong on a watch-only list — flag these in concerns, don't auto-reject.

SCORING

Return a single overall_score from 0 to 100 (integer). Use the full range:
- 85–100 (strong_fit): three-for-three on fit, practitioner, authenticity. Confident recommendation.
- 65–84 (possible_fit): solid on most axes, one soft spot. Worth a closer look.
- 40–64 (weak_fit): notable gaps — wrong audience, thin niche overlap, or authenticity concerns.
- 0–39 (pass): off-domain, inauthentic (AI/aggregated), or audience mismatch.

CRITICAL: overall_score is on a 0–100 scale. Do not output 0–10 or 0–5. Scores of 8 or 9 mean "terrible fit, basically reject" — do not use them for strong creators.

OUTPUT (valid JSON only, no markdown, no commentary):

{
  "overall_score": 0,
  "verdict": "strong_fit" | "possible_fit" | "weak_fit" | "pass",
  "fit_summary": "2-3 sentences of plain prose explaining the fit. No headings, no bullet points.",
  "standout_signals": [{"text": "..."}],
  "concerns": [{"text": "..."}]
}

RULES
- overall_score is an integer 0–100. Verdict must match the band above.
- Max 3 standout_signals, max 3 concerns. Each ≤ 20 words.
- fit_summary ≤ 100 words, plain prose.`

  await setupPrompt(
    'score_creator_scores',
    ['campaign_context', 'creator_profile', 'content_items_text'],
    promptText,
  )

  try {
    const invoke = async () => {
      const raw = await applyPrompt('score_creator_scores', {
        campaign_context: `Brief: ${params.campaignBrief}\nTopics: ${params.topics.join(', ')}\nPersonas: ${params.personas.join(', ')}\nPrompt gaps: ${params.promptGaps.join('; ')}`,
        creator_profile: `Name: ${params.creatorName}\nBio: ${params.creatorBio}\nPlatforms: ${params.platforms.join(', ')}`,
        content_items_text: contentSummary,
      }, 'raw_text') as string
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      return parseAIJson(cleaned)
    }

    let parsed = await invoke()

    const verdictBand = (score: number): 'strong_fit' | 'possible_fit' | 'weak_fit' | 'pass' => {
      if (score >= 80) return 'strong_fit'
      if (score >= 60) return 'possible_fit'
      if (score >= 40) return 'weak_fit'
      return 'pass'
    }

    const validScale = (s: unknown): s is number =>
      typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= 100 && s > 10

    // Scale sanity check: if the LLM returned a /10 score (<=10), retry once.
    // A legitimate sub-10 score means "terrible fit" which should be rare; we'd
    // rather retry and risk a duplicate low score than silently save a 8/100.
    if (!validScale(parsed.overall_score)) {
      console.warn(`aiScoreCreator: suspect overall_score=${parsed.overall_score}, retrying once`)
      parsed = await invoke()
    }

    const score = typeof parsed.overall_score === 'number' ? Math.round(parsed.overall_score) : 0
    const clampedScore = Math.max(0, Math.min(100, score))
    // Still <=10 after retry → almost certainly a scale bug, flag for review
    const scaleSuspect = clampedScore > 0 && clampedScore <= 10
    const verdict: 'strong_fit' | 'possible_fit' | 'weak_fit' | 'pass' =
      (['strong_fit', 'possible_fit', 'weak_fit', 'pass'] as const).includes(parsed.verdict)
        ? parsed.verdict
        : verdictBand(clampedScore)

    const needs_manual_review = scaleSuspect || typeof parsed.overall_score !== 'number'
    const needs_manual_review_reason = scaleSuspect
      ? `Suspected scale bug: model returned ${parsed.overall_score} on 0–100 scale`
      : typeof parsed.overall_score !== 'number'
        ? 'overall_score missing or non-numeric'
        : null

    return {
      overall_score: clampedScore,
      verdict,
      fit_summary: parsed.fit_summary || parsed.rationale_md || '',
      standout_signals: parsed.standout_signals || parsed.strengths || [],
      concerns: parsed.concerns || parsed.weaknesses || [],
      needs_manual_review,
      needs_manual_review_reason,
    }
  } catch (e) {
    console.error('aiScoreCreator error:', e)
    throw new Error(`Scoring failed: ${(e as Error).message}`)
  }
}

// ---- AI: Enrich Evaluation — Stage 2 (evidence snippets + content angles) ----
// Lazy; triggered when a user opens a detail panel for a creator scoring >= 80.
export async function aiEnrichEvaluation(params: {
  campaignBrief: string;
  topics: string[];
  personas: string[];
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
  evidence_coverage: string;
  needs_manual_review: boolean;
  needs_manual_review_reason: string | null;
}> {
  const contentSummary = buildContentSummary(params.contentItems)

  try {
    await setupPrompt(
      'score_creator_evidence',
      ['campaign_context', 'creator_profile', 'content_items_text'],
      `You are a creator evaluation specialist with deep expertise in technical B2B content.

Campaign context: {campaign_context}

Creator profile: {creator_profile}

Ingested content: {content_items_text}

Extract evidence and propose content angles for this creator. Return ONLY valid JSON, no markdown.

CRITICAL RULE: Every evidence quote MUST be an exact substring from the content text provided above. Do not paraphrase. Extract verbatim.

TIMESTAMP RULE: For YouTube content where text is prefixed with [M:SS] timestamps, set timestamp_start_seconds to the total seconds value of the [M:SS] timestamp nearest to the beginning of the quoted text. For example, [3:42] → 222 seconds.

RULES:
- Max 4 evidence_snippets. Prefer coverage across multiple content items and multiple dimensions.
- dimension must be one of: technical_relevance, audience_alignment, content_quality, channel_performance, brand_fit.
- Max 2 content_angles.
- why_it_matters ≤ 25 words each.

Return this exact JSON structure:
{
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

    const raw = await applyPrompt('score_creator_evidence', {
      campaign_context: `Brief: ${params.campaignBrief}\nTopics: ${params.topics.join(', ')}\nPersonas: ${params.personas.join(', ')}`,
      creator_profile: `Name: ${params.creatorName}\nBio: ${params.creatorBio}\nPlatforms: ${params.platforms.join(', ')}`,
      content_items_text: contentSummary,
    }, 'raw_text') as string

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = parseAIJson(cleaned)

    const contentMap = new Map(params.contentItems.map(ci => [ci.id, ci.raw_text]))
    const failedQuotes: string[] = []
    for (const snippet of (parsed.evidence_snippets || [])) {
      const raw_text = contentMap.get(snippet.content_item_id)
      if (raw_text && !raw_text.includes(snippet.quote)) {
        failedQuotes.push(`Quote not found in content ${snippet.content_item_id}: "${snippet.quote.substring(0, 80)}..."`)
      }
    }

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

    return {
      evidence_snippets: parsed.evidence_snippets || [],
      content_angles: parsed.content_angles || [],
      evidence_coverage,
      needs_manual_review: failedQuotes.length > 0,
      needs_manual_review_reason: failedQuotes.length > 0 ? `Evidence validation failed: ${failedQuotes.join('; ')}` : null,
    }
  } catch (e) {
    console.error('aiEnrichEvaluation error:', e)
    throw new Error(`Enrichment failed: ${(e as Error).message}`)
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
    if (!cleaned || cleaned === 'None' || cleaned === 'null' || cleaned === 'undefined') return [];
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
  console.log(`[parseAIJson] length=${text.length} tail=${JSON.stringify(text.slice(-60))}`)
  // Builder API sometimes returns "None" (Python null) instead of JSON
  if (!text || text === 'None' || text === 'null' || text === 'undefined') {
    throw new Error('Builder returned empty/null response')
  }
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
  const scoreFields = ['overall_score']
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
    // Extract new-rubric fields
    const summaryMatch = text.match(/"fit_summary"\s*:\s*"((?:[^"\\]|\\.)*)/)
    if (summaryMatch) recovered.fit_summary = summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')

    const verdictMatch = text.match(/"verdict"\s*:\s*"(strong_fit|possible_fit|weak_fit|pass)"/)
    if (verdictMatch) recovered.verdict = verdictMatch[1]

    const standoutMatch = text.match(/"standout_signals"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
    if (standoutMatch) {
      try { recovered.standout_signals = JSON5.parse(`[${standoutMatch[1]}]`) } catch { recovered.standout_signals = [] }
    }

    const concernsMatch = text.match(/"concerns"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
    if (concernsMatch) {
      try { recovered.concerns = JSON5.parse(`[${concernsMatch[1]}]`) } catch { recovered.concerns = [] }
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
