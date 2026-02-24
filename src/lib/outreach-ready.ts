import { dbQuery } from './db'

const COVERAGE_RANK: Record<string, number> = { strong: 3, medium: 2, weak: 1, none: 0 }

export async function checkOutreachReady(campaignCreatorId: string): Promise<{
  ready: boolean;
  blockers: string[];
}> {
  const blockers: string[] = []

  // Get campaign_creator + creator + evaluation + settings
  const ccRes = await dbQuery(
    `SELECT cc.*, c.competitor_affiliated, c.is_autodubbed_suspected, c.is_dormant,
       ce.overall_score, ce.evidence_coverage, ce.needs_manual_review
     FROM campaign_creators cc
     JOIN creators c ON c.id = cc.creator_id
     LEFT JOIN creator_evaluations ce ON ce.campaign_creator_id = cc.id
     WHERE cc.id = $1`,
    [campaignCreatorId]
  )

  if (!ccRes.data.length) return { ready: false, blockers: ['Campaign creator not found'] }
  const cc = ccRes.data[0] as Record<string, unknown>

  const settingsRes = await dbQuery(`SELECT * FROM app_settings LIMIT 1`, [])
  const settings = settingsRes.data[0] as Record<string, unknown> | undefined
  const threshold = (settings?.outreach_ready_score_threshold as number) || 75
  const minCoverage = (settings?.min_evidence_coverage as string) || 'medium'

  // Check evaluation exists
  if (!cc.overall_score && cc.overall_score !== 0) blockers.push('No evaluation exists')
  // Score threshold
  if (cc.overall_score !== null && (cc.overall_score as number) < threshold) {
    blockers.push(`Score ${cc.overall_score} below threshold ${threshold}`)
  }
  // Evidence coverage
  const coverageRank = COVERAGE_RANK[cc.evidence_coverage as string] || 0
  const minRank = COVERAGE_RANK[minCoverage] || 0
  if (coverageRank < minRank) {
    blockers.push(`Evidence coverage "${cc.evidence_coverage}" does not meet minimum "${minCoverage}"`)
  }
  // Campaign DNC
  if (cc.campaign_do_not_contact) blockers.push('Campaign do-not-contact flag active')
  // Competitor
  if (cc.competitor_affiliated) blockers.push('Creator is competitor-affiliated')
  // Autodubbed
  if (cc.is_autodubbed_suspected) blockers.push('Creator suspected autodubbed')
  // Needs manual review
  if (cc.needs_manual_review) blockers.push('Evaluation marked needs_manual_review')

  // Global DNC flag
  const dncRes = await dbQuery(
    `SELECT * FROM creator_status_flags WHERE creator_id = $1 AND flag = 'do_not_contact' AND is_active = true LIMIT 1`,
    [cc.creator_id]
  )
  if (dncRes.data.length) blockers.push('Global do-not-contact flag active')

  // Price too high flag
  const priceRes = await dbQuery(
    `SELECT * FROM creator_status_flags WHERE creator_id = $1 AND flag = 'price_too_high' AND is_active = true LIMIT 1`,
    [cc.creator_id]
  )
  if (priceRes.data.length) blockers.push('Price too high flag active')

  return { ready: blockers.length === 0, blockers }
}
