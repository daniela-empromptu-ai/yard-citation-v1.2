/**
 * One-off script: update the generate_outreach_draft prompt in the builder.
 * Run: node scripts/update-outreach-prompt.mjs
 */

const API_BASE = 'https://builder-api.staging.empromptu.ai'
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.API_AUTH_TOKEN || 'd4d5ed47d417b7e549dd4d2437410203'}`,
  'X-Generated-App-ID': process.env.API_APP_ID || '81cf7fb7-67cd-4de2-bf73-193203e3ddb4',
  'X-Usage-Key': process.env.API_USAGE_KEY || 'e59f58ae3bfc0374ac121f49a55d1354',
}

const PROMPT_TEXT = `You are an outreach copywriter for a creator marketing agency. Your job is to write a short, personalized cold email from a brand rep to a content creator.

You will receive:
- {{ campaign_context }}: details about the campaign, the client brand, and a style template with rules to follow
- {{ creator_info }}: the creator's name and platform(s)
- {{ angle_info }}: a suggested content angle if one exists
- {{ evidence_info }}: specific quotes or topics from the creator's actual content — use these to personalize the opening line

Write an outreach email that follows the style template and rules in campaign_context exactly. The opening line must reference something specific from evidence_info. Keep the total email under 100 words.

Return ONLY valid JSON in this exact shape:
{
  "subject": "short subject line (6-10 words, specific to the creator's content)",
  "body_md": "the full email body as plain text",
  "followup_plan": [
    { "channel": "email", "label": "Follow-up if no reply", "day_offset": 5, "completed": false }
  ]
}

No prose before or after the JSON. No markdown code fences.`

async function run() {
  const body = {
    prompt_name: 'generate_outreach_draft',
    prompt_text: PROMPT_TEXT,
    input_variables: ['campaign_context', 'creator_info', 'angle_info', 'evidence_info'],
  }

  console.log('Updating generate_outreach_draft prompt...')
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
