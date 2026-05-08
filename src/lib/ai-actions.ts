'use server'

import { callAIApi } from './db'
import JSON5 from 'json5'

async function applyPrompt(name: string, inputData: Record<string, string>, returnType: string, retries = 2): Promise<unknown> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let result: { value: unknown }
    try {
      result = await callAIApi('/apply_prompt_to_data', {
        prompt_name: name,
        input_data: { ...inputData, return_type: returnType },
      }) as { value: unknown }
    } catch (e) {
      const msg = (e as Error).message
      if ((msg.includes('500') || msg.includes('Prompt execution returned no result')) && attempt < retries) {
        console.warn(`[applyPrompt] ${name}: transient 500, retrying (${attempt + 1}/${retries})`)
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)))
        continue
      }
      throw e
    }

    const value = result.value

    if (value === 'None' || value === null || value === undefined) {
      if (attempt < retries) {
        console.log(`[applyPrompt] ${name}: got None response, retrying (${attempt + 1}/${retries})`)
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      return value
    }

    if (typeof value === 'string' && !value.trim().startsWith('{') && !value.trim().startsWith('[') && value.length < 500) {
      if (attempt < retries) {
        console.log(`[applyPrompt] ${name}: got conversational response (variable substitution failed?), retrying (${attempt + 1}/${retries})`)
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
    }

    return value
  }
}

// ---- AI: Suggest Topics ----
export async function aiSuggestTopics(brief: string): Promise<Array<{
  topic: string; confidence: number; rationale: string
}>> {
  try {
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

  // Prompt managed in builder GUI as 'score_creator_scores'.
  // To update the prompt text, paste into the builder UI — do not add setupPrompt here.

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

/**
 * House style for outreach emails. Single canonical example (Michael's voice)
 * that the LLM matches for tone, length, and structure. Bracketed merge
 * fields are illustrative — the LLM should fill them with concrete values
 * from the campaign / creator context, not output literal brackets.
 */
const OUTREACH_STYLE_EXAMPLE = `Hi [Name],

[Specific reference to something they actually wrote/covered — one sentence, shows you read it.]

I work with [client], [one-line description of what it does and why it's relevant to their audience]. [One concrete detail that makes it a natural fit — a stat, a feature, a gap in their piece.]

Would you be open to [specific ask — a mention, a section addition, a collaboration]? [Brief, easy CTA — happy to share X, or just reply to this.]

— [SENDER_NAME]`

// ---- AI: Generate Outreach Draft ----
export async function aiGenerateOutreachDraft(params: {
  campaignName: string;
  campaignBrief: string;
  creatorName: string;
  platforms: string[];
  selectedAngle: { title: string; format: string; key_points: string[] } | null;
  evidenceSnippets: Array<{ quote: string; url: string; why_it_matters: string }>;
  senderName?: string;
  /** Override the house style example. Defaults to OUTREACH_STYLE_EXAMPLE. */
  styleExample?: string;
}): Promise<{
  subject: string;
  body_md: string;
  followup_plan: Array<{
    channel: string; label: string; day_offset: number; completed: boolean
  }>;
}> {
  const senderName = params.senderName || 'Michael'
  const styleExample = (params.styleExample || OUTREACH_STYLE_EXAMPLE).replace(/\[SENDER_NAME\]/g, senderName)
  try {
    const raw = await applyPrompt('generate_outreach_draft', {
      campaign_context:
        `Campaign: ${params.campaignName}\n${params.campaignBrief.substring(0, 500)}\n\n` +
        `STYLE REFERENCE — match this voice, length (under 100 words), and structure exactly. Rules:\n` +
        `1. Open with a SPECIFIC reference to something the creator actually wrote/covered (use the evidence snippets — quote a title, a specific point they made, or a topic they covered). Do NOT open with "I'd like to..." or introduce yourself first.\n` +
        `2. Introduce the client in one line with a concrete detail (stat, feature, why it fits their audience).\n` +
        `3. Make a single clear ask. Keep it easy to say yes to.\n` +
        `4. Sign off with just the sender name — no title, no company.\n` +
        `5. Replace ALL bracketed placeholders with real values from context. Never output literal brackets.\n\n` +
        `STYLE TEMPLATE:\n${styleExample}`,
      creator_info: `Creator: ${params.creatorName}\nPlatforms: ${params.platforms.join(', ')}`,
      angle_info: params.selectedAngle
        ? `Title: ${params.selectedAngle.title}\nFormat: ${params.selectedAngle.format}\nKey points: ${params.selectedAngle.key_points.join(', ')}`
        : 'No specific angle selected',
      evidence_info: params.evidenceSnippets.length > 0
        ? `Evidence from the creator's actual content (use these to personalize the opener):\n` +
          params.evidenceSnippets.map((e, i) => `${i + 1}. "${e.quote}"${e.url ? ` (${e.url})` : ''} — ${e.why_it_matters}`).join('\n')
        : 'No specific evidence available — reference their general platform and topic focus.',
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
  excludedHandles?: Set<string>;
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
    const campaignContext = [
      `Brief: ${params.brief}`,
      `Topics: ${params.topics.join(', ')}`,
      `Personas: ${params.personas.join(', ')}`,
    ].join('\n');
    console.log(`[aiDiscoverCreators] input sizes — campaign_context: ${campaignContext.length} chars, seed_creators: ${seedList.length} chars, count: ${n}`);

    const raw = await applyPrompt('discover_lookalike_creators', {
      campaign_context: campaignContext,
      seed_creators: seedList,
      count: String(n),
    }, 'raw_text') as string;

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    if (!cleaned || cleaned === 'None' || cleaned === 'null' || cleaned === 'undefined') return [];
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    // Filter out creators already in DB or explicitly excluded (e.g. dismissed in this campaign)
    return parsed.filter((c: { platform: string; handle: string }) => {
      const key = `${c.platform}:${(c.handle || '').toLowerCase().replace(/^@/, '')}`;
      if (params.existingHandles.has(key)) return false;
      if (params.excludedHandles && params.excludedHandles.has(key)) return false;
      return true;
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
