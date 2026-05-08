/**
 * One-off script: update the score_creator_scores prompt in the builder.
 * Run: node scripts/update-score-prompt.mjs
 */

const API_BASE = 'https://builder-api.staging.empromptu.ai'
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.API_AUTH_TOKEN || 'd4d5ed47d417b7e549dd4d2437410203'}`,
  'X-Generated-App-ID': process.env.API_APP_ID || '81cf7fb7-67cd-4de2-bf73-193203e3ddb4',
  'X-Usage-Key': process.env.API_USAGE_KEY || 'e59f58ae3bfc0374ac121f49a55d1354',
}

const PROMPT_TEXT = `You are a creator partnership analyst evaluating whether an independent content creator is a strong fit for a brand campaign.

IMPORTANT CALIBRATION: Every creator you evaluate has already passed automated discovery and prequalification filters. They cover the right topic area and have a real audience. Your job is to rank them relative to each other — not to gatekeep. Score generously where the fit is real.

Score anchors (0–100):
- 90–100: Exceptional fit. The creator's content, audience, and voice are a near-perfect match. Strong reach or niche authority.
- 75–89: Strong fit. Clear topical overlap, right audience profile, credible voice. Minor gaps don't disqualify.
- 60–74: Good fit. Covers the space, real audience, could work well. Some mismatch in tone, depth, or specific topics.
- 45–59: Marginal fit. Tangentially related. Audience or content focus is off but not disqualifying.
- Below 45: Weak fit. Reserve for creators who actively conflict with the brand or have disqualifying signals.

Default upward when unsure. A creator who covers the topic with a real audience and no red flags deserves at least 70.

Campaign context:
{{ campaign_context }}

Creator profile:
{{ creator_profile }}

Content samples:
{{ content_items_text }}

Evaluate this creator and return ONLY valid JSON — no prose, no code fences:
{
  "overall_score": <integer 0–100>,
  "verdict": <"strong_fit" | "possible_fit" | "weak_fit" | "pass">,
  "fit_summary": "<2–3 sentence summary of why this creator fits or doesn't>",
  "standout_signals": [{ "text": "<specific positive signal>" }],
  "concerns": [{ "text": "<specific concern, only if genuine>" }]
}`

async function run() {
  const body = {
    prompt_name: 'score_creator_scores',
    prompt_text: PROMPT_TEXT,
    input_variables: ['campaign_context', 'creator_profile', 'content_items_text'],
  }

  console.log('Updating score_creator_scores prompt...')
  const res = await fetch(`${API_BASE}/setup_ai_prompt`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify(body),
  })

  const text = await res.text()
  console.log(`Status: ${res.status}`)
  console.log('Response:', text)
}

run().catch(console.error)
