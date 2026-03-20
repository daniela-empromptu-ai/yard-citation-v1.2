import { NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function DELETE() {
  try {
    const camps = await dbQuery<{ id: string }>(`SELECT id FROM ${t('campaigns')} WHERE name LIKE '[DEMO]%'`, [])
    for (const camp of camps.data) {
      const ccs = await dbQuery<{ id: string }>(`SELECT id FROM ${t('campaign_creators')} WHERE campaign_id = $1`, [camp.id])
      for (const cc of ccs.data) {
        await dbQuery(`DELETE FROM ${t('evidence_snippets')} WHERE evaluation_id IN (SELECT id FROM ${t('creator_evaluations')} WHERE campaign_creator_id = $1)`, [cc.id])
        await dbQuery(`DELETE FROM ${t('content_angles')} WHERE evaluation_id IN (SELECT id FROM ${t('creator_evaluations')} WHERE campaign_creator_id = $1)`, [cc.id])
        await dbQuery(`DELETE FROM ${t('creator_evaluations')} WHERE campaign_creator_id = $1`, [cc.id])
      }
      await dbQuery(`DELETE FROM ${t('campaign_creators')} WHERE campaign_id = $1`, [camp.id])
      await dbQuery(`DELETE FROM ${t('job_events')} WHERE job_id IN (SELECT id FROM ${t('jobs')} WHERE campaign_id = $1)`, [camp.id])
      await dbQuery(`DELETE FROM ${t('jobs')} WHERE campaign_id = $1`, [camp.id])
      await dbQuery(`DELETE FROM ${t('activity_log')} WHERE campaign_id = $1`, [camp.id])
      await dbQuery(`DELETE FROM ${t('campaign_search_terms')} WHERE campaign_id = $1`, [camp.id])
      await dbQuery(`DELETE FROM ${t('campaign_topics')} WHERE campaign_id = $1`, [camp.id])
      await dbQuery(`DELETE FROM ${t('campaigns')} WHERE id = $1`, [camp.id])
    }
    return NextResponse.json({ ok: true, deleted: camps.data.length })
  } catch (e) {
    console.error('[demo/setup DELETE]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST() {
  try {
    // ── Prerequisites ─────────────────────────────────────────────
    const userRows = await dbQuery<{ id: string }>(`SELECT id FROM ${t('app_users')} ORDER BY created_at LIMIT 1`, [])
    const userId = userRows.data[0]?.id
    if (!userId) return NextResponse.json({ error: 'No app_users found' }, { status: 500 })

    let clientId: string
    const existClient = await dbQuery<{ id: string }>(`SELECT id FROM ${t('clients')} WHERE name='Demo Co' LIMIT 1`, [])
    if (existClient.data[0]?.id) {
      clientId = existClient.data[0].id
    } else {
      await dbQuery(`INSERT INTO ${t('clients')} (name, created_at, updated_at) VALUES ('Demo Co', now(), now())`, [])
      const newClient = await dbQuery<{ id: string }>(`SELECT id FROM ${t('clients')} WHERE name='Demo Co' LIMIT 1`, [])
      clientId = newClient.data[0]?.id
      if (!clientId) return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
    }

    // ── Idempotency: return existing demo campaign ────────────────
    const existCamp = await dbQuery<{ id: string }>(`SELECT id FROM ${t('campaigns')} WHERE name LIKE '[DEMO]%' LIMIT 1`, [])
    if (existCamp.data[0]?.id) {
      return NextResponse.json({ campaign_id: existCamp.data[0].id })
    }

    // ── Campaign ──────────────────────────────────────────────────
    const campaignId = uuidv4()
    await dbQuery(
      `INSERT INTO ${t('campaigns')} (id, name, client_id, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, personas, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', 'review', '{"US","EU","UK"}', 'English', 'FinOps Platform',
         'Position our FinOps platform as the go-to solution for Kubernetes cost optimization. Target DevOps engineers and platform teams who manage cloud spend across multi-cluster environments. Emphasize real-world cost savings, showback/chargeback workflows, and integration with existing observability stacks (Prometheus, Grafana). Key differentiators: real-time cost anomaly detection, namespace-level cost allocation, and automated right-sizing recommendations.',
         '{"Platform engineer managing K8s clusters","FinOps lead responsible for cloud cost reporting","DevOps team lead evaluating cost management tooling"}',
         now(), now())`,
      [campaignId, '[DEMO] FinOps & K8s Cost Optimization', clientId, userId]
    )

    // ── Topics ────────────────────────────────────────────────────
    const topics = [
      'Kubernetes cost optimization', 'FinOps practices and tooling', 'Cloud cost management',
      'Container resource right-sizing', 'Multi-cluster cost visibility',
    ]
    for (let i = 0; i < topics.length; i++) {
      await dbQuery(
        `INSERT INTO ${t('campaign_topics')} (campaign_id, topic, source, confidence, order_index, approved, created_at, updated_at)
         VALUES ($1, $2, 'ai', $3, $4, true, now(), now())`,
        [campaignId, topics[i], 0.95 - i * 0.03, i]
      )
    }

    // ── Search Terms (15, all approved) ───────────────────────────
    const terms: [string, string, string][] = [
      ['kubernetes cost optimization tools', 'product_category', 'Directly targets engineers searching for K8s cost solutions'],
      ['finops kubernetes best practices', 'product_category', 'Reaches FinOps practitioners focused on container workloads'],
      ['kubecost vs cloudhealth comparison', 'competitor', 'Captures comparison shoppers evaluating cost tools'],
      ['opencost kubernetes monitoring', 'competitor', 'Targets users of the open-source cost alternative'],
      ['reduce kubernetes cloud spend', 'problem_solution', 'Matches engineers actively trying to cut costs'],
      ['kubernetes resource right-sizing guide', 'tutorial_format', 'Tutorial seekers are high-intent learners'],
      ['cloud cost showback chargeback k8s', 'implementation', 'Specific workflow that FinOps teams implement'],
      ['multi-cluster cost visibility', 'product_category', 'Key pain point for enterprise platform teams'],
      ['prometheus cost metrics kubernetes', 'integration', 'Targets users integrating cost data with existing monitoring'],
      ['spot instances kubernetes autoscaling', 'implementation', 'Practical cost savings implementation topic'],
      ['finops foundation certified practitioner', 'product_category', 'Reaches FinOps community members and learners'],
      ['kubernetes namespace cost allocation', 'problem_solution', 'Common enterprise cost attribution challenge'],
      ['grafana kubernetes cost dashboard', 'integration', 'Targets Grafana users wanting cost visibility'],
      ['helm chart resource limits best practices', 'tutorial_format', 'DevOps engineers setting resource constraints'],
      ['GKE EKS AKS cost comparison', 'competitor', 'Multi-cloud cost comparison searchers'],
    ]
    for (let i = 0; i < terms.length; i++) {
      await dbQuery(
        `INSERT INTO ${t('campaign_search_terms')} (campaign_id, term, category_tag, why_it_helps, order_index, approved, approved_by_user_id, approved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, $6, now(), now(), now())`,
        [campaignId, terms[i][0], terms[i][1], terms[i][2], i, userId]
      )
    }

    // ── Creators (upsert) ─────────────────────────────────────────
    const creatorDefs = [
      { name: 'DevOps & AI Toolkit', handle: 'devopstoolkit', subs: 94800, rel: 'warm' },
      { name: 'Anton Putra', handle: 'antonputra', subs: 117000, rel: 'warm' },
      { name: 'Abhishek Veeramalla', handle: 'abhishekveeramalla', subs: 595000, rel: 'hot' },
      { name: 'Techno Tim', handle: 'technotim', subs: 322000, rel: 'cold' },
      { name: 'Bret Fisher', handle: 'bretfisher', subs: 80700, rel: 'warm' },
      { name: 'That DevOps Guy', handle: 'marceldempers', subs: 89400, rel: 'cold' },
      { name: 'Rawkode Academy', handle: 'rawkodeacademy', subs: 28300, rel: 'warm' },
      { name: 'Cloud With Raj', handle: 'cloudwithraj', subs: 125000, rel: 'cold' },
    ]
    const creatorIds: Record<string, string> = {}
    for (const cr of creatorDefs) {
      const existing = await dbQuery<{ id: string }>(`SELECT id FROM ${t('creators')} WHERE handle=$1 AND platform='youtube' LIMIT 1`, [cr.handle])
      if (existing.data.length === 0) {
        await dbQuery(
          `INSERT INTO ${t('creators')} (name, display_name, platform, handle, url, subscriber_count, content_language, relationship_status, discovered_via, created_at, updated_at)
           VALUES ($1,$1,'youtube',$2,$3,$4,'English',$5,'demo',now(),now())`,
          [cr.name, cr.handle, `https://youtube.com/@${cr.handle}`, cr.subs, cr.rel]
        )
      }
      const row = await dbQuery<{ id: string }>(`SELECT id FROM ${t('creators')} WHERE handle=$1 AND platform='youtube' LIMIT 1`, [cr.handle])
      if (row.data[0]?.id) creatorIds[cr.handle] = row.data[0].id
    }

    // ── Content Items ─────────────────────────────────────────────
    const contentDefs: { handle: string; title: string; url: string; words: number; daysAgo: number }[] = [
      { handle: 'devopstoolkit', title: 'Kubernetes Cost Optimization — 5 Strategies That Actually Work', url: 'https://youtube.com/watch?v=demo-dt1', words: 4500, daysAgo: 8 },
      { handle: 'devopstoolkit', title: 'Is Kubecost Worth It? Honest Review After 6 Months', url: 'https://youtube.com/watch?v=demo-dt2', words: 5200, daysAgo: 20 },
      { handle: 'devopstoolkit', title: 'OpenCost vs Kubecost: Open Source FinOps Compared', url: 'https://youtube.com/watch?v=demo-dt3', words: 3800, daysAgo: 35 },
      { handle: 'antonputra', title: 'EKS vs GKE: True Cost Comparison 2024', url: 'https://youtube.com/watch?v=demo-ap1', words: 5500, daysAgo: 10 },
      { handle: 'antonputra', title: 'Grafana Cost Dashboard for Kubernetes', url: 'https://youtube.com/watch?v=demo-ap2', words: 4200, daysAgo: 22 },
      { handle: 'abhishekveeramalla', title: 'Kubernetes Cost Optimization Zero to Hero', url: 'https://youtube.com/watch?v=demo-av1', words: 6800, daysAgo: 12 },
      { handle: 'abhishekveeramalla', title: 'DevOps Cost Management Complete Guide', url: 'https://youtube.com/watch?v=demo-av2', words: 7500, daysAgo: 28 },
      { handle: 'technotim', title: 'Kubernetes Cost Tracking with Prometheus', url: 'https://youtube.com/watch?v=demo-tt1', words: 4100, daysAgo: 15 },
      { handle: 'technotim', title: 'Self-Hosted FinOps Dashboard Tutorial', url: 'https://youtube.com/watch?v=demo-tt2', words: 3600, daysAgo: 40 },
      { handle: 'bretfisher', title: 'Container Resource Management Best Practices', url: 'https://youtube.com/watch?v=demo-bf1', words: 5100, daysAgo: 18 },
      { handle: 'bretfisher', title: 'K8s Cost Pitfalls Every Team Makes', url: 'https://youtube.com/watch?v=demo-bf2', words: 3900, daysAgo: 32 },
      { handle: 'marceldempers', title: 'Azure AKS Cost Optimization Tips', url: 'https://youtube.com/watch?v=demo-md1', words: 4300, daysAgo: 14 },
      { handle: 'marceldempers', title: 'Kubernetes Spot Instances Deep Dive', url: 'https://youtube.com/watch?v=demo-md2', words: 3700, daysAgo: 38 },
      { handle: 'rawkodeacademy', title: 'CNCF FinOps Tools Landscape 2024', url: 'https://youtube.com/watch?v=demo-ra1', words: 4800, daysAgo: 9 },
      { handle: 'rawkodeacademy', title: 'Platform Engineering & Cost Control', url: 'https://youtube.com/watch?v=demo-ra2', words: 3500, daysAgo: 25 },
      { handle: 'cloudwithraj', title: 'Kubernetes Cost Optimization That You Do NOT Know', url: 'https://youtube.com/watch?v=demo-cr1', words: 4600, daysAgo: 7 },
      { handle: 'cloudwithraj', title: 'AWS EKS Cost Savings: Real Numbers', url: 'https://youtube.com/watch?v=demo-cr2', words: 3800, daysAgo: 30 },
    ]
    const contentIds: Record<string, string> = {} // url → id
    for (const ci of contentDefs) {
      const creatorId = creatorIds[ci.handle]
      if (!creatorId) continue
      const existCI = await dbQuery<{ id: string }>(`SELECT id FROM ${t('content_items')} WHERE url=$1 LIMIT 1`, [ci.url])
      if (existCI.data.length === 0) {
        await dbQuery(
          `INSERT INTO ${t('content_items')} (creator_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, ingestion_method, ingestion_status, created_at, updated_at)
           VALUES ($1,'youtube','youtube_video',$2,$3, now() - interval '${ci.daysAgo} days', now(),'English','[demo transcript]',$4,'demo','complete',now(),now())`,
          [creatorId, ci.title, ci.url, ci.words]
        )
      }
      const row = await dbQuery<{ id: string }>(`SELECT id FROM ${t('content_items')} WHERE url=$1 LIMIT 1`, [ci.url])
      if (row.data[0]?.id) contentIds[ci.url] = row.data[0].id
    }

    // ── Campaign Creators (all scored) ────────────────────────────
    const ccIds: Record<string, string> = {} // handle → cc.id
    for (const cr of creatorDefs) {
      const creatorId = creatorIds[cr.handle]
      if (!creatorId) continue
      const existCC = await dbQuery<{ id: string }>(`SELECT id FROM ${t('campaign_creators')} WHERE campaign_id=$1 AND creator_id=$2 LIMIT 1`, [campaignId, creatorId])
      if (existCC.data.length === 0) {
        await dbQuery(
          `INSERT INTO ${t('campaign_creators')} (campaign_id, creator_id, added_by_user_id, source, pipeline_stage, scoring_status, created_at, updated_at)
           VALUES ($1,$2,$3,'db_match','scored','scored', now(), now())`,
          [campaignId, creatorId, userId]
        )
      }
      const row = await dbQuery<{ id: string }>(`SELECT id FROM ${t('campaign_creators')} WHERE campaign_id=$1 AND creator_id=$2 LIMIT 1`, [campaignId, creatorId])
      if (row.data[0]?.id) ccIds[cr.handle] = row.data[0].id
    }

    // ── Evaluations ───────────────────────────────────────────────
    type EvalDef = { handle: string; overall: number; tech: number; aud: number; qual: number; perf: number; brand: number; cov: string; nmr: boolean; nmrReason?: string; strengths: string[]; weaknesses: string[]; rationale: string }
    const evals: EvalDef[] = [
      { handle: 'devopstoolkit', overall: 91, tech: 95, aud: 88, qual: 92, perf: 85, brand: 93, cov: 'strong', nmr: false,
        strengths: ['Deep Kubernetes cost optimization expertise with hands-on tool comparisons', 'Regular publishing cadence (2-3x/week) maintains audience engagement', 'Authentic voice — community trusts tool recommendations over vendor marketing'],
        weaknesses: ['Audience skews very senior — may miss mid-level practitioners', 'European timezone limits live engagement with US audience'],
        rationale: 'Viktor Farcic is a top-tier match. His recent Kubecost review and OpenCost comparison directly address the FinOps space. Three videos in 5 weeks on cost optimization, with an audience of senior DevOps engineers — the exact persona this campaign targets.' },
      { handle: 'antonputra', overall: 87, tech: 90, aud: 84, qual: 88, perf: 82, brand: 86, cov: 'strong', nmr: false,
        strengths: ['Cost-comparison format perfectly matches product positioning needs', 'Data-driven approach with real infrastructure benchmarks', 'Growing rapidly with infrastructure-focused audience'],
        weaknesses: ['Smaller audience than some competitors', 'Video style can be dry — less entertainment value'],
        rationale: 'Anton\'s EKS vs GKE cost comparison and Grafana cost dashboard videos demonstrate exactly the format needed for a FinOps campaign. His data-driven, benchmark-heavy style lends credibility.' },
      { handle: 'abhishekveeramalla', overall: 86, tech: 82, aud: 90, qual: 84, perf: 92, brand: 82, cov: 'strong', nmr: false,
        strengths: ['Massive engaged audience (595K subs) with high view counts', 'Comprehensive tutorial format covers full cost optimization workflow', 'Zero-to-hero style makes complex FinOps topics accessible'],
        weaknesses: ['Audience skews beginner-to-intermediate', 'India-based — verify geo alignment with campaign targets'],
        rationale: 'Abhishek\'s K8s Cost Optimization Zero to Hero is a perfect fit. 595K subscribers and consistently high engagement. His tutorial-first approach would work well for product integration content.' },
      { handle: 'technotim', overall: 79, tech: 75, aud: 82, qual: 80, perf: 85, brand: 72, cov: 'partial', nmr: false,
        strengths: ['Homelab-to-enterprise crossover audience with purchasing influence', 'Prometheus + Grafana content directly aligns with integration story', 'Highly trusted in the self-hosted infrastructure community'],
        weaknesses: ['Homelab focus may not translate to enterprise purchasing decisions', 'Cost content is secondary to his infrastructure tutorials'],
        rationale: 'Tim\'s Prometheus cost tracking video shows relevant expertise, but his primary focus is homelab infrastructure. The enterprise cost optimization angle is secondary to his core content.' },
      { handle: 'bretfisher', overall: 83, tech: 88, aud: 80, qual: 85, perf: 78, brand: 84, cov: 'strong', nmr: false,
        strengths: ['Docker Captain with deep container expertise — high credibility', 'Container resource management content directly relevant', 'Experienced with sponsored content — professional delivery'],
        weaknesses: ['Slower publishing cadence than peers', 'Docker-centric audience may need K8s angle reinforcement'],
        rationale: 'Bret\'s resource management best practices and cost pitfalls videos directly address FinOps concerns. His Docker Captain status and professional approach make him ideal for sponsored integrations.' },
      { handle: 'marceldempers', overall: 76, tech: 80, aud: 74, qual: 78, perf: 72, brand: 74, cov: 'partial', nmr: true, nmrReason: 'Only 2 of 15 recent videos touch cost optimization directly. Verify depth of FinOps coverage and willingness to create dedicated cost content before engagement.',
        strengths: ['Practical hands-on style with real K8s cluster demos', 'Azure AKS expertise covers multi-cloud angle', 'Consistent quality across 400+ videos'],
        weaknesses: ['Cost content is a small fraction of overall output', 'Smaller reach compared to top-tier DevOps creators', 'Australia timezone limits live US/EU engagement'],
        rationale: 'Marcel covers AKS cost optimization and spot instances, but cost content is not his primary focus. His practical demo style would work well for product walkthroughs if he\'s willing to dedicate videos to FinOps.' },
      { handle: 'rawkodeacademy', overall: 74, tech: 82, aud: 68, qual: 80, perf: 62, brand: 78, cov: 'partial', nmr: true, nmrReason: 'Small but highly engaged audience (28K subs). Strong CNCF connections could amplify reach beyond subscriber count. Evaluate ROI given smaller direct reach.',
        strengths: ['Strong CNCF community connections — conference speaker and organizer', 'CNCF FinOps tools landscape video shows direct topical expertise', 'Platform engineering angle aligns with emerging buyer persona'],
        weaknesses: ['Smaller audience limits direct reach', 'Publishing schedule inconsistent', 'Revenue ROI harder to justify with 28K subs'],
        rationale: 'David\'s CNCF connections and FinOps landscape coverage make him valuable for community credibility, but the 28K subscriber base means reach is limited. Best suited for community-focused campaigns rather than broad awareness.' },
      { handle: 'cloudwithraj', overall: 81, tech: 84, aud: 78, qual: 80, perf: 80, brand: 82, cov: 'strong', nmr: false,
        strengths: ['Direct K8s cost optimization content with practical AWS examples', 'Strong title/thumbnail game drives high CTR', 'Growing audience with cloud-native engineering focus'],
        weaknesses: ['Relatively new channel — track record still developing', 'AWS-centric may need multi-cloud broadening'],
        rationale: 'Raj\'s "Cost Optimization That You Do NOT Know" video directly targets our keyword space. His AWS EKS cost savings content with real numbers aligns perfectly with the data-driven positioning this campaign needs.' },
    ]

    const evalIds: Record<string, string> = {} // handle → evaluation.id
    for (const ev of evals) {
      const ccId = ccIds[ev.handle]
      if (!ccId) continue
      const existEval = await dbQuery<{ id: string }>(`SELECT id FROM ${t('creator_evaluations')} WHERE campaign_creator_id=$1 LIMIT 1`, [ccId])
      if (existEval.data.length === 0) {
        await dbQuery(
          `INSERT INTO ${t('creator_evaluations')} (campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, needs_manual_review_reason,
            overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit,
            strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
           VALUES ($1,'anthropic','claude-sonnet-4-5-20250514', now() - interval '1 hour', $2, $3, $4,
            $5,$6,$7,$8,$9,$10, $11::jsonb, $12::jsonb, $13, now(), now())`,
          [ccId, ev.cov, ev.nmr, ev.nmrReason || null, ev.overall, ev.tech, ev.aud, ev.qual, ev.perf, ev.brand,
           JSON.stringify(ev.strengths), JSON.stringify(ev.weaknesses), ev.rationale]
        )
      }
      const row = await dbQuery<{ id: string }>(`SELECT id FROM ${t('creator_evaluations')} WHERE campaign_creator_id=$1 LIMIT 1`, [ccId])
      if (row.data[0]?.id) evalIds[ev.handle] = row.data[0].id
    }

    // ── Evidence Snippets ─────────────────────────────────────────
    type SnipDef = { handle: string; contentUrl: string; quote: string; dimension: string; why: string; ts?: number }
    const snippets: SnipDef[] = [
      { handle: 'devopstoolkit', contentUrl: 'https://youtube.com/watch?v=demo-dt1', dimension: 'technical_relevance', ts: 245,
        quote: 'The biggest mistake teams make with Kubernetes cost optimization is not setting resource requests and limits. Without them, you\'re flying blind on actual cluster utilization.',
        why: 'Demonstrates deep understanding of the core FinOps challenge this campaign addresses' },
      { handle: 'devopstoolkit', contentUrl: 'https://youtube.com/watch?v=demo-dt2', dimension: 'brand_fit', ts: 180,
        quote: 'After six months with Kubecost, here\'s what I actually think. The namespace-level cost allocation is where it shines — but there are gaps.',
        why: 'Shows willingness to give honest tool reviews, which builds audience trust for sponsored content' },
      { handle: 'devopstoolkit', contentUrl: 'https://youtube.com/watch?v=demo-dt3', dimension: 'content_quality', ts: 420,
        quote: 'Let me show you real numbers from our production cluster. This isn\'t a toy demo — these are 200 nodes running actual workloads.',
        why: 'Uses real production data, not synthetic demos — exactly the credibility this campaign needs' },
      { handle: 'antonputra', contentUrl: 'https://youtube.com/watch?v=demo-ap1', dimension: 'technical_relevance', ts: 310,
        quote: 'When you compare the actual compute cost per pod across EKS, GKE, and AKS, the numbers tell a very different story than the marketing pages.',
        why: 'Cost-comparison expertise directly aligns with product positioning strategy' },
      { handle: 'antonputra', contentUrl: 'https://youtube.com/watch?v=demo-ap2', dimension: 'audience_alignment', ts: 150,
        quote: 'I built this Grafana dashboard specifically for FinOps teams who need to show cost breakdown by namespace and team.',
        why: 'Targets the exact FinOps persona this campaign is designed for' },
      { handle: 'abhishekveeramalla', contentUrl: 'https://youtube.com/watch?v=demo-av1', dimension: 'audience_alignment', ts: 520,
        quote: 'If you\'re a DevOps engineer and your manager asks why the cloud bill went up 40% last month, this video will save your career.',
        why: 'Frames cost optimization as career-relevant, not just technical — drives engagement' },
      { handle: 'abhishekveeramalla', contentUrl: 'https://youtube.com/watch?v=demo-av2', dimension: 'channel_performance',
        quote: 'This complete guide has everything from setting up Prometheus metrics to building executive cost dashboards.',
        why: 'Comprehensive tutorial format demonstrates ability to integrate product mentions naturally' },
      { handle: 'technotim', contentUrl: 'https://youtube.com/watch?v=demo-tt1', dimension: 'technical_relevance', ts: 380,
        quote: 'Prometheus can track your Kubernetes costs in real-time. Let me show you the exact PromQL queries I use.',
        why: 'Prometheus integration expertise directly relevant to product\'s monitoring stack integration' },
      { handle: 'bretfisher', contentUrl: 'https://youtube.com/watch?v=demo-bf1', dimension: 'content_quality', ts: 290,
        quote: 'Most teams set CPU requests once and never touch them again. Here\'s how to build a right-sizing review into your sprint process.',
        why: 'Practical, actionable advice format that works well for product integration content' },
      { handle: 'bretfisher', contentUrl: 'https://youtube.com/watch?v=demo-bf2', dimension: 'brand_fit', ts: 445,
        quote: 'I\'ve seen teams waste $50K a month because they didn\'t understand the difference between requests and limits.',
        why: 'Quantifies the cost problem in dollar terms — exactly the messaging this campaign needs' },
      { handle: 'marceldempers', contentUrl: 'https://youtube.com/watch?v=demo-md1', dimension: 'technical_relevance', ts: 200,
        quote: 'Azure AKS has some hidden cost optimizations most people don\'t know about. Let me walk you through the advisor recommendations.',
        why: 'Multi-cloud cost expertise adds breadth to the campaign\'s platform coverage' },
      { handle: 'rawkodeacademy', contentUrl: 'https://youtube.com/watch?v=demo-ra1', dimension: 'brand_fit', ts: 340,
        quote: 'The CNCF FinOps landscape is exploding. Here are the tools that actually matter in 2024 and why.',
        why: 'CNCF landscape authority could position the product within the official ecosystem narrative' },
      { handle: 'cloudwithraj', contentUrl: 'https://youtube.com/watch?v=demo-cr1', dimension: 'technical_relevance', ts: 180,
        quote: 'Most people focus on compute costs, but did you know that cross-AZ data transfer can account for 30% of your EKS bill?',
        why: 'Highlights non-obvious cost drivers that the product addresses — great for awareness content' },
      { handle: 'cloudwithraj', contentUrl: 'https://youtube.com/watch?v=demo-cr2', dimension: 'audience_alignment',
        quote: 'I saved my company $12,000 a month with these three changes. Real numbers, real clusters, no BS.',
        why: 'Data-driven ROI messaging matches the campaign\'s proof-point positioning strategy' },
    ]

    for (const sn of snippets) {
      const evalId = evalIds[sn.handle]
      const ciId = contentIds[sn.contentUrl]
      if (!evalId || !ciId) continue
      await dbQuery(
        `INSERT INTO ${t('evidence_snippets')} (evaluation_id, content_item_id, quote, dimension, why_it_matters, timestamp_start_seconds, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
        [evalId, ciId, sn.quote, sn.dimension, sn.why, sn.ts || null]
      )
    }

    // ── Content Angles ────────────────────────────────────────────
    type AngleDef = { handle: string; title: string; format: string; persona: string; points: string[] }
    const angles: AngleDef[] = [
      { handle: 'devopstoolkit', title: 'K8s Cost Showdown: Your Tool vs Open-Source Alternatives', format: 'comparison_video', persona: 'DevOps team lead evaluating cost management tooling',
        points: ['Head-to-head feature comparison with Kubecost/OpenCost', 'Real cluster cost data walkthrough', 'Integration with existing Prometheus/Grafana stack'] },
      { handle: 'devopstoolkit', title: 'The Hidden Costs of Kubernetes Nobody Talks About', format: 'deep_dive', persona: 'Platform engineer managing K8s clusters',
        points: ['Cross-AZ data transfer costs', 'Idle resource waste quantification', 'Automated right-sizing demo'] },
      { handle: 'antonputra', title: 'Multi-Cloud K8s Cost Dashboard Build', format: 'tutorial', persona: 'FinOps lead responsible for cloud cost reporting',
        points: ['Grafana dashboard from scratch', 'EKS + GKE + AKS unified view', 'Alerting on cost anomalies'] },
      { handle: 'abhishekveeramalla', title: 'K8s Cost Optimization: Complete Zero to Hero', format: 'tutorial_series', persona: 'DevOps team lead evaluating cost management tooling',
        points: ['Resource requests/limits fundamentals', 'Namespace cost allocation setup', 'Executive cost reporting dashboard'] },
      { handle: 'technotim', title: 'Self-Hosted FinOps: Track Every Dollar', format: 'tutorial', persona: 'Platform engineer managing K8s clusters',
        points: ['Prometheus cost metrics collection', 'Grafana dashboard templates', 'Alert on spend anomalies'] },
      { handle: 'bretfisher', title: 'Container Cost Mistakes That Cost $50K/Month', format: 'listicle', persona: 'DevOps team lead evaluating cost management tooling',
        points: ['Top 5 resource configuration mistakes', 'Right-sizing workflow for sprint teams', 'Before/after cost savings proof points'] },
      { handle: 'cloudwithraj', title: 'Real AWS EKS Cost Savings: Before & After', format: 'case_study', persona: 'FinOps lead responsible for cloud cost reporting',
        points: ['Real cluster cost data comparison', 'Step-by-step optimization walkthrough', 'Monthly savings quantification'] },
    ]

    for (const angle of angles) {
      const evalId = evalIds[angle.handle]
      if (!evalId) continue
      await dbQuery(
        `INSERT INTO ${t('content_angles')} (evaluation_id, title, format, persona, key_points_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())`,
        [evalId, angle.title, angle.format, angle.persona, JSON.stringify(angle.points)]
      )
    }

    return NextResponse.json({ campaign_id: campaignId })
  } catch (e) {
    console.error('[demo/setup]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
