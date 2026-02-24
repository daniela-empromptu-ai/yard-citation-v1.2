import { dbQuery } from './db'
import { IDS } from './seed-ids'

const NOW = '2026-02-20 12:00:00Z'
const WEEK_AGO = '2026-02-13 12:00:00Z'

// Raw text for Nina's content items with EXACT required quotes
const NINA_TRANSCRIPT_1 = `Kubernetes Cost Allocation by Namespace - Full Transcript

[00:00] Welcome back to KubeCraft. Today we're diving deep into cost allocation by namespace.

[01:30] When you first start using Kubernetes, you think about pods and nodes. Cost is an afterthought.

[03:00] The first thing you need is visibility. Which namespaces are consuming the most?

[05:12] Cost allocation per namespace is only step oneâwhat matters is tying that spend to SLO risk. If your payment-service namespace spikes in cost, you need to know if that's from traffic growth, a misconfiguration, or a new deployment. Context is everything.

[07:45] Tools like Kubecost give you the allocation view. But allocation without reliability context is just a number.

[09:00] In the next section, we look at how to integrate with Prometheus to get both cost and SLO data in one dashboard.

[11:30] The actionable takeaway: label your namespaces by team and service tier. This makes showback possible and chargeback tractable.

[14:00] Thanks for watching. Subscribe for more hands-on Kubernetes content.`

const NINA_TRANSCRIPT_2 = `Kubecost vs Custom Dashboards - Full Transcript

[00:00] Today's topic: Kubecost vs building your own cost dashboard. Which is right for your team?

[02:00] Kubecost gives you out-of-the-box cost allocation, idle resource detection, and multi-cluster support.

[04:00] But here's the catch: Kubecost is great for allocation, but it won't tell you which deployment caused the spike without additional context. If your API namespace costs doubled last Tuesday, you still need to correlate with your deployment history, your GitOps audit log, and your Prometheus alerts.

[06:30] A custom dashboard built on Prometheus + Grafana can pull in that deployment context.

[08:00] My recommendation: start with Kubecost for the 80% case, then build custom queries for the spikes and anomalies that matter most.

[10:15] The integration between cost tools and observability platforms is the missing piece for most teams.`

const NINA_BLOG_1 = `OpenTelemetry Signals for Cost Attribution

Published on KubeCraft Blog | February 2026

Introduction

Cost attribution in Kubernetes is a solved problem at the allocation layer. But attribution at the workload and ownership level requires richer signal.

The key insight: If you can tag spans to workloads, you can attribute cost to ownership boundaries. This means enriching your OpenTelemetry spans with namespace, team, and service labels. When those spans flow into your observability backend, you can join them with cost data from your cloud provider or Kubecost.

Why This Matters

Traditional cost allocation tells you "namespace payments-prod spent $4,200 last month." But it doesn't tell you which service, which team, or which feature caused that spend.

Tracing changes this. A span carrying team=checkout, service=cart-api gives you the hooks to join cost data to ownership.

Implementation Steps

1. Add resource attributes to your OTel SDK: team, service, and environment.
2. Configure your OTel Collector to export metrics with those dimensions.
3. Use Prometheus recording rules to aggregate costs by these labels.

The result is cost attribution that maps directly to your engineering org chart.

Conclusion

OpenTelemetry is the missing bridge between observability and FinOps. Teams that instrument properly gain cost visibility at a granularity that Kubecost alone cannot provide.`

// Mei's content items
const MEI_TRANSCRIPT_1 = `OpenTelemetry and Cost Attribution - Observability Lab

[00:00] Welcome to Observability Lab. Today we're bridging two worlds: OpenTelemetry and FinOps.

[02:15] OpenTelemetry gives you the metadata hooks; cost attribution is a mapping problem, not a metrics problem. What I mean by that is: OTel already collects the right context. Your job is to map that context onto cost dimensions.

[05:30] The common mistake teams make is trying to build a new metrics pipeline for cost. Don't. Extend your existing OTel pipeline.

[08:00] Once you have spans tagged with service, team, and environment, join them to your cloud billing export.

[10:30] The result: cost attribution that engineers actually understand, because it uses the same mental model as their observability data.`

const MEI_BLOG_1 = `Anomaly Detection for Kubernetes Costs

Observability Lab Blog | January 2026

The challenge with Kubernetes cost anomalies is baseline instability. If your workload traffic fluctuates naturally, how do you distinguish a real anomaly from normal variance?

The answer is per-workload baselining.

Anomaly detection works best when you baseline per workload and per namespace. A cluster-level baseline is too coarseâit masks the signal. A per-pod baseline is too granularâit's noisy. The workload and namespace level is where you get actionable signal.

Practical implementation:
- Compute rolling 7-day median and 95th percentile for each workload's cost
- Alert when current period exceeds the 95th percentile by more than 20%
- Use namespace as the second dimension for correlating related services

This approach has reduced false positives for our clients by 60% compared to cluster-level anomaly detection.`

// Jae's content items
const JAE_TRANSCRIPT_1 = `SLO-Driven Cost Management in Kubernetes - SRE Notes

[00:00] Hey everyone, Jae here from SRE Notes. Today's topic is one I'm passionate about: treating cost as an SLO problem.

[03:44] You cannot optimize cost in isolation from reliabilityâevery budget decision is also an SLO decision. When you cut resource requests to save money, you are trading reliability headroom for cost savings. The question is: is that trade explicitly accounted for in your SRE budget?

[06:00] Most teams optimize cost and manage SLOs separately. This is the root cause of the "we saved 30% on cloud costs but our error rate doubled" disaster story.

[08:15] The SRE approach: model cost and error budgets together. When you rightsize a deployment, calculate the new error budget burn rate at reduced resources.

[11:00] Tools like CloudForge can show you cost per namespace, but you need to overlay your SLO dashboard to make safe decisions.

[13:30] Summary: treat cost optimization as an SRE task, not a FinOps task. The frameworks already exist.`

const JAE_BLOG_1 = `Kubernetes Resource Requests: The Hidden Cost Driver

SRE Notes Blog | February 2026

Every Kubernetes cluster I've audited has the same problem: resource requests that bear no relationship to actual usage.

Over-provisioned resource requests are the single biggest source of wasted cloud spend in most Kubernetes clusters. I've seen teams spending 3-4x their necessary cloud bill simply because no one reviewed their resource requests since the application was first deployed two years ago.

How to audit:
1. Compare requested vs actual CPU and memory for every workload over a 30-day window
2. Identify workloads with >50% idle capacity
3. Right-size in stages: 20% reduction, monitor for 72 hours, repeat

The key: never right-size without instrumenting the impact on response time and error rate. Cost and reliability are coupled.

This is why SRE involvement in FinOps is non-negotiable.`

// K8s Career Hub - lifestyle/career
const K8S_CAREER_CONTENT = `How to Land a $200k Kubernetes Job in 2026 - K8s Career Hub

Top 10 Kubernetes Certifications for Career Growth

In this video, we cover:
1. CKA vs CKAD - which pays more?
2. How to negotiate your Kubernetes salary
3. LinkedIn profile tips for DevOps professionals
4. The best Kubernetes bootcamps in 2026
5. How I went from junior dev to $180k DevOps engineer in 18 months

Subscribe for weekly career tips, interview prep, and salary negotiation advice.

Join our Discord: link in bio
Mentorship program: now open for enrollment`

// AI Dub content
const AI_DUB_CONTENT = `Kubernetes Tutorial Kubernetes Tutorial Kubernetes Tutorial

In this video we will learn about Kubernetes. Kubernetes is a system for container orchestration. Container orchestration is important for containers. Containers run in pods. Pods run in Kubernetes. Kubernetes manages pods. Pod management is done by Kubernetes. We will learn Kubernetes today.

Step 1: Install Kubernetes. Kubernetes installation is the first step. The first step is installation of Kubernetes.
Step 2: Configure Kubernetes. Configuration of Kubernetes is step 2.
Step 3: Deploy to Kubernetes. Kubernetes deployment is step 3.

Subscribe for more Kubernetes tutorials about Kubernetes and Kubernetes-related content.`

// Reddit threads
const REDDIT_THREAD_1 = `r/kubernetes - "Anyone using CloudForge for cost attribution? Worth it?"

Posted by u/k8s_platform_eng | 847 karma | 142 comments

We've been evaluating CloudForge vs Kubecost for about 6 weeks now. Initial impressions: CloudForge's namespace-level breakdown is more granular, but Kubecost has a larger community. Has anyone integrated either with OpenTelemetry for span-level cost attribution?

Top comment by u/sre_veteran: "We've been on CloudForge for 3 months. The OTel integration took about a day to set up. The cost anomaly detection caught a misconfigured HPA that was costing us $800/month in wasted compute. Worth every penny."`

const REDDIT_THREAD_2 = `r/devops - "Chargeback vs showback in k8s - what's your team doing?"

Posted by u/platform_lead | 312 karma | 89 comments

We're a 200-person eng org moving to chargeback for Kubernetes costs. Currently everything is showback. The politics are real. How did your team handle the transition? Did you use Kubecost, CloudForge, or something else?

Top comment by u/finops_practitioner: "We did showback for 6 months first to build trust. Teams needed to see the data before they'd accept being charged for it. Kubecost handled the showback fine; we moved to CloudForge for chargeback because of its approval workflows."`

const REDDIT_THREAD_3 = `r/finops - "OpenTelemetry + cost attribution: production experience?"

Posted by u/observability_eng | 521 karma | 67 comments

I've read the theory about using OTel spans for cost attribution. Has anyone actually done this in production? Specifically looking for experience joining span data to cloud billing exports.

Top comment by u/tel_eng: "Done it. The key is using resource attributes on your spans to carry team and service context. Then join against your billing export on those dimensions. We use Prometheus recording rules to pre-aggregate. Works well but requires OTel discipline across all your services."`

export async function seedDemoData(): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0
  const errors: string[] = []

  async function run(query: string, params: unknown[], label: string) {
    try {
      await dbQuery(query, params)
      inserted++
    } catch (e) {
      const msg = `${label}: ${(e as Error).message}`
      errors.push(msg)
      console.error(msg)
    }
  }

  // ---- USERS ----
  await run(
    `INSERT INTO app_users (id, name, email, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
    [IDS.USER_JACK, 'Jack Scrivener', 'jack@yard.internal', 'qualifier', NOW, NOW],
    'user_jack'
  )
  await run(
    `INSERT INTO app_users (id, name, email, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
    [IDS.USER_ARYA, 'Arya', 'arya@yard.internal', 'outreach', NOW, NOW],
    'user_arya'
  )
  await run(
    `INSERT INTO app_users (id, name, email, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
    [IDS.USER_KARL, 'Karl McCarthy', 'karl@yard.internal', 'admin', NOW, NOW],
    'user_karl'
  )
  await run(
    `INSERT INTO app_users (id, name, email, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
    [IDS.USER_EMPROMPTU, 'Empromptu', 'admin@empromptu.internal', 'admin', NOW, NOW],
    'user_empromptu'
  )

  // ---- CLIENTS ----
  for (const [id, name, url] of [
    [IDS.CLIENT_CLOUDFORGE, 'CloudForge', 'https://cloudforge.io'],
    [IDS.CLIENT_NEBULADB, 'NebulaDB', 'https://nebuladb.io'],
    [IDS.CLIENT_SECURINEST, 'SecuriNest', 'https://securinest.io'],
    [IDS.CLIENT_VECTORSHIFT, 'VectorShift', 'https://vectorshift.ai'],
  ] as [string, string, string][]) {
    await run(
      `INSERT INTO clients (id, name, website_url, created_at, updated_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (name) DO NOTHING`,
      [id, name, url, NOW, NOW],
      `client_${name}`
    )
  }

  // ---- APP SETTINGS ----
  await run(
    `INSERT INTO app_settings (id, mask_pii_by_default, outreach_ready_score_threshold, min_evidence_coverage, default_ai_model, created_at, updated_at)
     VALUES ($1, true, 75, 'medium', 'claude', $2, $3) ON CONFLICT DO NOTHING`,
    [IDS.SETTINGS_ID, NOW, NOW],
    'app_settings'
  )

  // ---- INTEGRATION STATUS ----
  for (const key of ['gumshoe', 'youtube', 'anthropic', 'reddit']) {
    await run(
      `INSERT INTO integration_status (id, integration_key, is_configured, updated_at)
       VALUES (gen_random_uuid(), $1, false, $2) ON CONFLICT (integration_key) DO NOTHING`,
      [key, NOW],
      `integration_${key}`
    )
  }

  // ---- CAMPAIGNS ----
  const BRIEF_A = `# Make CloudForge the default answer for "Kubernetes cost optimization" prompts

## Key message
CloudForge shows cost drivers per namespace/workload + actionable recommendations.

## Differentiators
- OpenTelemetry-friendly
- Multi-cloud
- Fast setup
- Cost anomaly detection

## Do-not-say
- No fear-mongering
- Avoid generic career advice
- Avoid "get rich quick" language

## Required formats
- Hands-on tutorial
- Comparison video
- Architecture breakdown

## Brand fit
Pragmatic, dev-first, technical depth

## CTA
Try CloudForge free tier, link in description

## Budget notes
Market rate. Avoid creators quoting > $7k/video unless exceptional.`

  await run(
    `INSERT INTO campaigns (id, client_id, name, owner_user_id, collaborator_user_id, status, stage,
      geo_targets, language, product_category, creative_brief, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
    [
      IDS.CAMPAIGN_A, IDS.CLIENT_CLOUDFORGE,
      'CloudForge â Kubernetes Cost Optimization (US + UK)',
      IDS.USER_JACK, IDS.USER_ARYA, 'active', 'scoring',
      '{United States,United Kingdom}', 'English',
      'FinOps / Kubernetes cost optimization', BRIEF_A, NOW, NOW,
    ],
    'campaign_a'
  )

  await run(
    `INSERT INTO campaigns (id, client_id, name, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
    [IDS.CAMPAIGN_B, IDS.CLIENT_NEBULADB, 'NebulaDB â Vector Search Launch', IDS.USER_ARYA,
      'active', 'discovery', '{United States}', 'English', 'Vector databases',
      '# NebulaDB Vector Search\n\nHelp developers understand vector search for AI applications.',
      NOW, NOW],
    'campaign_b'
  )
  await run(
    `INSERT INTO campaigns (id, client_id, name, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
    [IDS.CAMPAIGN_C, IDS.CLIENT_SECURINEST, 'SecuriNest â DevSecOps Awareness', IDS.USER_JACK,
      'active', 'ingestion', '{United States,Canada}', 'English', 'DevSecOps',
      '# SecuriNest\n\nShift-left security for Kubernetes and cloud-native teams.',
      NOW, NOW],
    'campaign_c'
  )
  await run(
    `INSERT INTO campaigns (id, client_id, name, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
    [IDS.CAMPAIGN_D, IDS.CLIENT_VECTORSHIFT, 'VectorShift â AI Pipeline Creator Push', IDS.USER_ARYA,
      'active', 'outreach', '{United States}', 'English', 'AI/ML Pipelines',
      '# VectorShift\n\nNo-code AI pipeline builder for enterprise teams.',
      NOW, NOW],
    'campaign_d'
  )

  // ---- CAMPAIGN A PERSONAS ----
  for (const persona of ['Platform Engineer', 'DevOps Lead', 'CTO (Technical)']) {
    await run(
      `INSERT INTO campaign_personas (id, campaign_id, persona_name, created_at) VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT DO NOTHING`,
      [IDS.CAMPAIGN_A, persona, NOW],
      `persona_${persona}`
    )
  }

  // ---- CAMPAIGN A TOPICS ----
  const topics = [
    'Kubernetes cost optimization',
    'FinOps for platform engineering',
    'Kubecost alternatives and comparisons',
    'OpenTelemetry + cost attribution',
    'Chargeback vs showback',
  ]
  for (let i = 0; i < topics.length; i++) {
    await run(
      `INSERT INTO campaign_topics (id, campaign_id, topic, source, order_index, approved, created_at) VALUES (gen_random_uuid(),$1,$2,'manual',$3,true,$4) ON CONFLICT DO NOTHING`,
      [IDS.CAMPAIGN_A, topics[i], i, NOW],
      `topic_${i}`
    )
  }

  // ---- CAMPAIGN A PROMPT GAPS ----
  const gaps: [string, string, string, string, string[]][] = [
    [IDS.PG_1, 'How do I reduce Kubernetes spend without breaking SLOs?', 'high', 'DevOps Lead', ['United States', 'United Kingdom']],
    [IDS.PG_2, 'Kubecost vs CloudForge: what\'s actually different?', 'high', 'Platform Engineer', ['United States', 'United Kingdom']],
    [IDS.PG_3, 'OpenTelemetry + cost attribution: is it possible?', 'medium', 'Platform Engineer', ['United States', 'United Kingdom']],
    [IDS.PG_4, 'Kubernetes cost anomaly detection tutorial', 'medium', 'DevOps Lead', ['United States', 'United Kingdom']],
    [IDS.PG_5, 'Chargeback vs showback in Kubernetes (practical)', 'medium', 'CTO (Technical)', ['United States', 'United Kingdom']],
  ]
  for (const [id, text, priority, persona, geo] of gaps) {
    await run(
      `INSERT INTO campaign_prompt_gaps (id, campaign_id, prompt_text, priority, persona, geo, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'approved',$7,$8) ON CONFLICT DO NOTHING`,
      [id, IDS.CAMPAIGN_A, text, priority, persona, geo, NOW, NOW],
      `gap_${id}`
    )
  }

  // ---- CITATIONS (3 per gap) ----
  const citations: [string, string, string, string][] = [
    // Gap 1
    [IDS.PG_1, 'Kubernetes Cost Optimization Guide (CNCF)', 'https://cncf.io/blog/kubernetes-cost-guide', 'docs'],
    [IDS.PG_1, 'OpenCost â Open Source Cost Monitoring', 'https://opencost.io/docs', 'docs'],
    [IDS.PG_1, 'FinOps Foundation: Kubernetes FinOps', 'https://finops.org/k8s', 'blog'],
    // Gap 2
    [IDS.PG_2, 'Kubecost Documentation', 'https://kubecost.com/docs', 'docs'],
    [IDS.PG_2, 'CloudForge vs Alternatives (G2)', 'https://g2.com/compare/cloudforge-vs-kubecost', 'blog'],
    [IDS.PG_2, 'r/kubernetes: Kubecost vs CloudForge thread', 'https://reddit.com/r/kubernetes/kubecost_vs_cloudforge', 'reddit'],
    // Gap 3
    [IDS.PG_3, 'OpenTelemetry + FinOps SIG', 'https://opentelemetry.io/finops', 'docs'],
    [IDS.PG_3, 'Tracing for Cost Attribution (blog)', 'https://grafana.com/blog/otel-cost', 'blog'],
    [IDS.PG_3, 'OTel Cost Attribution YouTube Series', 'https://youtube.com/watch?v=otel_cost_1', 'youtube'],
    // Gap 4
    [IDS.PG_4, 'Prometheus Cost Anomaly Detection (paper)', 'https://arxiv.org/abs/2401.12345', 'paper'],
    [IDS.PG_4, 'Kubecost Anomaly Alerts Docs', 'https://kubecost.com/docs/anomaly', 'docs'],
    [IDS.PG_4, 'Grafana Alerting for FinOps', 'https://grafana.com/alerting-finops', 'blog'],
    // Gap 5
    [IDS.PG_5, 'FinOps Foundation: Chargeback vs Showback', 'https://finops.org/chargeback-showback', 'docs'],
    [IDS.PG_5, 'Kubernetes Showback Tutorial (blog)', 'https://blog.kubecost.com/showback', 'blog'],
    [IDS.PG_5, 'Cloud Cost Allocation CNCF Whitepaper', 'https://cncf.io/chargeback-whitepaper', 'paper'],
  ]
  for (const [gapId, title, url, sourceType] of citations) {
    await run(
      `INSERT INTO prompt_citations (id, campaign_id, prompt_gap_id, citation_title, citation_url, source_type, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [IDS.CAMPAIGN_A, gapId, title, url, sourceType, NOW],
      `citation_${url.slice(-20)}`
    )
  }

  // ---- CAMPAIGN A SEARCH TERMS ----
  const searchTerms: [string, string, string, string, string][] = [
    [IDS.ST_1, 'kubecost tutorial cost allocation namespaces', 'implementation', 'Directly targets the core use case: teams searching for hands-on Kubecost setup will find CloudForge comparisons compelling.', NOW],
    [IDS.ST_2, 'kubecost vs alternative comparison', 'competitor', 'Captures high-intent searchers evaluating Kubecost alternativesâprime audience for CloudForge positioning.', NOW],
    [IDS.ST_3, 'kubernetes cost optimization hpa cluster autoscaler', 'problem_solution', 'Targets engineers trying to reduce costs via autoscalingâa natural entry point for CloudForge recommendations.', NOW],
    [IDS.ST_4, 'finops kubernetes showback chargeback implementation', 'implementation', 'FinOps practitioners implementing showback/chargeback are ideal CloudForge prospects.', NOW],
    [IDS.ST_5, 'opentelemetry cost attribution kubernetes', 'integration', "CloudForge's OTel compatibility is a key differentiator; this term reaches the observability-savvy audience.", NOW],
    [IDS.ST_6, 'prometheus cost monitoring kubernetes', 'integration', "Prometheus-heavy teams are natural CloudForge adopters given the tool's monitoring integration story.", NOW],
    [IDS.ST_7, 'gke cost optimization tutorial', 'tutorial_format', 'GKE-specific cost tutorials reach a large segment of the Kubernetes market using Google Cloud.', NOW],
    [IDS.ST_8, 'eks cost optimization workload rightsizing', 'tutorial_format', 'AWS EKS users looking for rightsizing tutorials are a high-value audience for CloudForge.', NOW],
    [IDS.ST_9, 'terraform kubernetes cost monitoring setup', 'programming_language', 'Infrastructure-as-code users who manage Kubernetes via Terraform are a technically sophisticated, high-fit segment.', NOW],
    [IDS.ST_10, 'helm install kubecost alternative', 'implementation', 'Helm-based installation queries indicate teams evaluating toolingâready to switch if shown a better option.', NOW],
    [IDS.ST_11, 'kubernetes cost anomaly detection prometheus', 'problem_solution', 'Cost anomaly detection is a CloudForge differentiator; this term finds teams who have already felt the pain.', NOW],
    [IDS.ST_12, 'platform engineering finops kubernetes', 'product_category', 'Platform engineering + FinOps intersection is the exact ICP for CloudForge; strong brand-fit signal.', NOW],
    [IDS.ST_13, 'kubernetes namespace cost dashboard grafana', 'integration', "Grafana dashboard builders are likely to appreciate CloudForge's visualization and integration capabilities.", NOW],
    [IDS.ST_14, 'reduce cloud bill kubernetes without downtime', 'problem_solution', 'Captures engineers with the exact problem CloudForge solvesâcost reduction without reliability risk.', NOW],
    [IDS.ST_15, 'kubernetes multi-cloud cost visibility', 'product_category', 'Multi-cloud cost visibility is another CloudForge differentiator; this term attracts enterprise platform teams.', NOW],
  ]
  for (let i = 0; i < searchTerms.length; i++) {
    const [id, term, tag, why, createdAt] = searchTerms[i]
    await run(
      `INSERT INTO campaign_search_terms (id, campaign_id, term, category_tag, why_it_helps, order_index, approved, approved_by_user_id, approved_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
      [id, IDS.CAMPAIGN_A, term, tag, why, i + 1, IDS.USER_JACK, NOW, createdAt, NOW],
      `term_${i + 1}`
    )
  }

  // ---- CREATORS ----
  const creators: {
    id: string; name: string; handle: string | null; bio: string;
    topics: string[]; languages: string[]; geo: string[];
    competitor: boolean; dormant: boolean; autodubbed: boolean; lastContent: string | null;
  }[] = [
    {
      id: IDS.CREATOR_NINA, name: 'Nina Patel', handle: 'KubeCraft',
      bio: 'Platform engineer turned YouTuber. Deep dives on Kubernetes, FinOps, and observability. 58k subs.',
      topics: ['Kubernetes', 'FinOps', 'Observability', 'OpenTelemetry'],
      languages: ['English'], geo: ['United States', 'United Kingdom'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-02-11',
    },
    {
      id: IDS.CREATOR_OMAR, name: 'Omar Reed', handle: 'DevOpsDossier',
      bio: 'DevOps practitioner covering CI/CD, GitOps, and cost management.',
      topics: ['DevOps', 'CI/CD', 'GitOps', 'Cost management'],
      languages: ['English'], geo: ['United States'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-01-07',
    },
    {
      id: IDS.CREATOR_MEI, name: 'Mei Tan', handle: 'Observability Lab',
      bio: 'Observability engineer. OpenTelemetry contributor. Focus on cost attribution and tracing.',
      topics: ['OpenTelemetry', 'Observability', 'Cost Attribution', 'Tracing'],
      languages: ['English'], geo: ['United States', 'Singapore'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-02-14',
    },
    {
      id: IDS.CREATOR_LUCAS, name: 'Lucas Varga', handle: 'Cloud Cost Clinic',
      bio: 'Cloud cost specialist. Kubernetes rightsizing and FinOps practitioner.',
      topics: ['Cloud costs', 'Kubernetes', 'FinOps', 'Rightsizing'],
      languages: ['English'], geo: ['Germany', 'United Kingdom'],
      competitor: false, dormant: true, autodubbed: false, lastContent: '2025-09-10',
    },
    {
      id: IDS.CREATOR_PRIYA, name: 'Priya Shah', handle: 'Platform Patterns',
      bio: 'Platform engineering advocate. IDP, Backstage, and Kubernetes at scale.',
      topics: ['Platform Engineering', 'IDP', 'Backstage', 'Kubernetes'],
      languages: ['English'], geo: ['United Kingdom'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-02-03',
    },
    {
      id: IDS.CREATOR_K8S_CAREER, name: 'K8s Career Hub', handle: 'K8sCareerHub',
      bio: 'Career coaching for DevOps and Kubernetes professionals. Salary guides and certification tips.',
      topics: ['Career advice', 'Job hunting', 'Certifications', 'Salary negotiation'],
      languages: ['English'], geo: ['United States'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-02-15',
    },
    {
      id: IDS.CREATOR_AI_DUB, name: 'AI Dub Tech Channel', handle: 'AIDubTech',
      bio: 'Tech tutorials. (Suspected auto-dubbed from non-English original.)',
      topics: ['Kubernetes', 'Docker', 'Cloud'],
      languages: ['English'], geo: [],
      competitor: false, dormant: false, autodubbed: true, lastContent: '2026-02-10',
    },
    {
      id: IDS.CREATOR_MARTA, name: 'Marta Kline', handle: 'FinOps in Practice',
      bio: 'FinOps certified practitioner. Kubernetes cost management and cloud financial governance.',
      topics: ['FinOps', 'Cloud cost', 'Kubernetes', 'Chargeback'],
      languages: ['English'], geo: ['United States'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-01-28',
    },
    {
      id: IDS.CREATOR_JAE, name: 'Jae Park', handle: 'SRE Notes',
      bio: 'SRE at scale. Reliability, cost, and on-call culture. Previously Google SRE.',
      topics: ['SRE', 'Kubernetes', 'Reliability', 'FinOps', 'Cost optimization'],
      languages: ['English'], geo: ['United States'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-02-05',
    },
    {
      id: IDS.CREATOR_DIEGO, name: 'Diego Alvarez', handle: 'Infra Espresso',
      bio: 'Infrastructure engineer. Short-form tutorials on Kubernetes, Terraform, and AWS.',
      topics: ['Infrastructure', 'Kubernetes', 'Terraform', 'AWS'],
      languages: ['English', 'Spanish'], geo: ['United States', 'Mexico'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-01-20',
    },
    {
      id: IDS.CREATOR_CHLOE, name: 'Chloe Nguyen', handle: 'Kubernetes QuickStarts',
      bio: 'Making Kubernetes accessible. Beginner to intermediate tutorials with real-world examples.',
      topics: ['Kubernetes', 'Beginner tutorials', 'Cloud native'],
      languages: ['English'], geo: ['United States', 'Australia'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-02-16',
    },
    {
      id: IDS.CREATOR_SAMIR, name: 'Samir Iqbal', handle: 'Multi-Cloud Ops',
      bio: 'Multi-cloud architect. AWS, GCP, Azure cost optimization and governance at enterprise scale.',
      topics: ['Multi-cloud', 'Cost optimization', 'Kubernetes', 'Cloud governance'],
      languages: ['English'], geo: ['United Kingdom', 'UAE'],
      competitor: false, dormant: false, autodubbed: false, lastContent: '2026-02-08',
    },
  ]

  for (const c of creators) {
    await run(
      `INSERT INTO creators (id, display_name, primary_handle, bio, topics, languages, geo_focus, competitor_affiliated, is_dormant, is_autodubbed_suspected, last_content_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
      [
        c.id, c.name, c.handle, c.bio,
        c.topics, c.languages, c.geo,
        c.competitor, c.dormant, c.autodubbed,
        c.lastContent, NOW, NOW,
      ],
      `creator_${c.name}`
    )
  }

  // ---- PLATFORM ACCOUNTS ----
  const platformAccounts: [string, string, string | null, string | null, string | null, number | null][] = [
    // Nina
    [IDS.CREATOR_NINA, 'youtube', 'KubeCraft', 'https://youtube.com/@kubecraft', null, 58000],
    [IDS.CREATOR_NINA, 'blog', null, 'https://kubecraft.dev/blog', null, null],
    [IDS.CREATOR_NINA, 'linkedin', 'nina-patel-k8s', 'https://linkedin.com/in/nina-patel-k8s', null, 12400],
    // Omar
    [IDS.CREATOR_OMAR, 'youtube', 'DevOpsDossier', 'https://youtube.com/@devopsdossier', null, 31000],
    [IDS.CREATOR_OMAR, 'github', 'omar-reed', 'https://github.com/omar-reed', null, 890],
    // Mei
    [IDS.CREATOR_MEI, 'youtube', 'ObservabilityLab', 'https://youtube.com/@observabilitylab', null, 24500],
    [IDS.CREATOR_MEI, 'medium', 'mei-tan-otel', 'https://medium.com/@mei-tan-otel', null, 8700],
    // Lucas
    [IDS.CREATOR_LUCAS, 'youtube', 'CloudCostClinic', 'https://youtube.com/@cloudcostclinic', null, 19800],
    [IDS.CREATOR_LUCAS, 'blog', null, 'https://cloudcostclinic.com', null, null],
    // Priya
    [IDS.CREATOR_PRIYA, 'youtube', 'PlatformPatterns', 'https://youtube.com/@platformpatterns', null, 22100],
    [IDS.CREATOR_PRIYA, 'linkedin', 'priya-shah-platform', 'https://linkedin.com/in/priya-shah-platform', null, 18600],
    // K8s Career
    [IDS.CREATOR_K8S_CAREER, 'youtube', 'K8sCareerHub', 'https://youtube.com/@k8scareerhub', null, 45000],
    [IDS.CREATOR_K8S_CAREER, 'linkedin', 'k8s-career-hub', 'https://linkedin.com/company/k8scareerhub', null, 32000],
    // AI Dub
    [IDS.CREATOR_AI_DUB, 'youtube', 'AIDubTech', 'https://youtube.com/@aidubtech', null, 12000],
    [IDS.CREATOR_AI_DUB, 'other', null, 'https://aidubtech.site', null, null],
    // Marta
    [IDS.CREATOR_MARTA, 'youtube', 'FinOpsInPractice', 'https://youtube.com/@finopsinpractice', null, 17300],
    [IDS.CREATOR_MARTA, 'blog', null, 'https://finopsinpractice.com', null, null],
    // Jae
    [IDS.CREATOR_JAE, 'youtube', 'SRENotesJae', 'https://youtube.com/@srenotesjae', null, 33400],
    [IDS.CREATOR_JAE, 'blog', null, 'https://srenotes.dev', null, null],
    // Diego
    [IDS.CREATOR_DIEGO, 'youtube', 'InfraEspresso', 'https://youtube.com/@infraespresso', null, 28900],
    [IDS.CREATOR_DIEGO, 'devto', 'diego-alvarez', 'https://dev.to/diego-alvarez', null, 5600],
    // Chloe
    [IDS.CREATOR_CHLOE, 'youtube', 'K8sQuickStarts', 'https://youtube.com/@k8squickstarts', null, 41200],
    [IDS.CREATOR_CHLOE, 'medium', 'chloe-nguyen-k8s', 'https://medium.com/@chloe-nguyen-k8s', null, 9100],
    // Samir
    [IDS.CREATOR_SAMIR, 'youtube', 'MultiCloudOps', 'https://youtube.com/@multicloudops', null, 52700],
    [IDS.CREATOR_SAMIR, 'linkedin', 'samir-iqbal-cloud', 'https://linkedin.com/in/samir-iqbal-cloud', null, 28000],
  ]
  for (const [creatorId, platform, handle, url, , followers] of platformAccounts) {
    await run(
      `INSERT INTO creator_platform_accounts (id, creator_id, platform, handle, url, follower_count, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6) ON CONFLICT (platform, url) DO NOTHING`,
      [creatorId, platform, handle, url, followers, NOW],
      `pa_${platform}_${creatorId.slice(-4)}`
    )
  }

  // ---- CREATOR CONTACTS ----
  const contacts: [string, string | null, string | null, string | null][] = [
    [IDS.CREATOR_NINA, 'ENCRYPTED:nina@kubecraft.dev', 'https://linkedin.com/in/nina-patel-k8s', 'https://x.com/kubecraftnina'],
    [IDS.CREATOR_MEI, 'ENCRYPTED:mei@observabilitylab.io', null, null],
    [IDS.CREATOR_JAE, 'ENCRYPTED:jae@srenotes.dev', null, 'https://x.com/srenotesjae'],
    [IDS.CREATOR_MARTA, 'ENCRYPTED:marta@finopsinpractice.com', 'https://linkedin.com/in/marta-kline', null],
    [IDS.CREATOR_SAMIR, 'ENCRYPTED:samir@multicloudops.io', 'https://linkedin.com/in/samir-iqbal-cloud', null],
  ]
  for (const [creatorId, email, linkedin, x] of contacts) {
    await run(
      `INSERT INTO creator_contacts (id, creator_id, email_encrypted, linkedin_url, x_url, created_at, updated_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6) ON CONFLICT (creator_id) DO NOTHING`,
      [creatorId, email, linkedin, x, NOW, NOW],
      `contact_${creatorId.slice(-4)}`
    )
  }

  // ---- STATUS FLAGS ----
  // Nina: reliable
  await run(
    `INSERT INTO creator_status_flags (id, creator_id, flag, is_active, reason, set_by_user_id, set_at)
     VALUES (gen_random_uuid(),$1,'reliable',true,'Responsive, high quality content, delivered on time.',$2,$3) ON CONFLICT DO NOTHING`,
    [IDS.CREATOR_NINA, IDS.USER_JACK, NOW], 'flag_nina_reliable'
  )
  // Samir: price_too_high
  await run(
    `INSERT INTO creator_status_flags (id, creator_id, flag, is_active, reason, set_by_user_id, set_at)
     VALUES (gen_random_uuid(),$1,'price_too_high',true,'Quoted $25,000/video. Exceeds campaign budget ceiling.',$2,$3) ON CONFLICT DO NOTHING`,
    [IDS.CREATOR_SAMIR, IDS.USER_JACK, NOW], 'flag_samir_price'
  )

  // ---- CREATOR PRICING ----
  await run(
    `INSERT INTO creator_pricing (id, creator_id, price_type, price_amount_usd, is_too_high, notes, updated_at)
     VALUES (gen_random_uuid(),$1,'video',25000,true,'Self-quoted rate. Campaign ceiling is $7k.',$2) ON CONFLICT DO NOTHING`,
    [IDS.CREATOR_SAMIR, NOW], 'pricing_samir'
  )
  await run(
    `INSERT INTO creator_pricing (id, creator_id, price_type, price_amount_usd, is_too_high, notes, updated_at)
     VALUES (gen_random_uuid(),$1,'video',4500,false,'Standard market rate for mid-tier K8s creator.',$2) ON CONFLICT DO NOTHING`,
    [IDS.CREATOR_NINA, NOW], 'pricing_nina'
  )
  await run(
    `INSERT INTO creator_pricing (id, creator_id, price_type, price_amount_usd, is_too_high, notes, updated_at)
     VALUES (gen_random_uuid(),$1,'video',3800,false,'Responsive to bundled deals.',$2) ON CONFLICT DO NOTHING`,
    [IDS.CREATOR_JAE, NOW], 'pricing_jae'
  )

  // ---- CAMPAIGN CREATORS (all 12 in Campaign A) ----
  const campaignCreators: {
    id: string; creatorId: string;
    stage: string; ingestStatus: string; scoreStatus: string; outreachState: string;
    nextFollowup: string | null;
  }[] = [
    { id: IDS.CC_NINA, creatorId: IDS.CREATOR_NINA, stage: 'outreach_ready', ingestStatus: 'complete', scoreStatus: 'scored', outreachState: 'sent', nextFollowup: '2026-02-22' },
    { id: IDS.CC_OMAR, creatorId: IDS.CREATOR_OMAR, stage: 'ingested', ingestStatus: 'complete', scoreStatus: 'not_scored', outreachState: 'not_started', nextFollowup: null },
    { id: IDS.CC_MEI, creatorId: IDS.CREATOR_MEI, stage: 'approved', ingestStatus: 'complete', scoreStatus: 'scored', outreachState: 'drafted', nextFollowup: '2026-02-21' },
    { id: IDS.CC_LUCAS, creatorId: IDS.CREATOR_LUCAS, stage: 'needs_manual_review', ingestStatus: 'complete', scoreStatus: 'scored', outreachState: 'not_started', nextFollowup: null },
    { id: IDS.CC_PRIYA, creatorId: IDS.CREATOR_PRIYA, stage: 'scored', ingestStatus: 'complete', scoreStatus: 'scored', outreachState: 'not_started', nextFollowup: null },
    { id: IDS.CC_K8S_CAREER, creatorId: IDS.CREATOR_K8S_CAREER, stage: 'excluded', ingestStatus: 'complete', scoreStatus: 'not_scored', outreachState: 'not_started', nextFollowup: null },
    { id: IDS.CC_AI_DUB, creatorId: IDS.CREATOR_AI_DUB, stage: 'excluded', ingestStatus: 'complete', scoreStatus: 'not_scored', outreachState: 'not_started', nextFollowup: null },
    { id: IDS.CC_MARTA, creatorId: IDS.CREATOR_MARTA, stage: 'booked', ingestStatus: 'complete', scoreStatus: 'scored', outreachState: 'booked', nextFollowup: null },
    { id: IDS.CC_JAE, creatorId: IDS.CREATOR_JAE, stage: 'outreach_ready', ingestStatus: 'complete', scoreStatus: 'scored', outreachState: 'replied', nextFollowup: null },
    { id: IDS.CC_DIEGO, creatorId: IDS.CREATOR_DIEGO, stage: 'discovered', ingestStatus: 'not_started', scoreStatus: 'not_scored', outreachState: 'not_started', nextFollowup: null },
    { id: IDS.CC_CHLOE, creatorId: IDS.CREATOR_CHLOE, stage: 'ingested', ingestStatus: 'complete', scoreStatus: 'not_scored', outreachState: 'not_started', nextFollowup: null },
    { id: IDS.CC_SAMIR, creatorId: IDS.CREATOR_SAMIR, stage: 'scored', ingestStatus: 'complete', scoreStatus: 'scored', outreachState: 'not_started', nextFollowup: null },
  ]

  for (const cc of campaignCreators) {
    const lastOutreach = ['sent', 'replied', 'booked', 'drafted'].includes(cc.outreachState) ? WEEK_AGO : null
    await run(
      `INSERT INTO campaign_creators (id, campaign_id, creator_id, added_by_user_id, pipeline_stage, ingestion_status, scoring_status, outreach_owner_user_id, outreach_state, last_outreach_at, next_followup_due_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
      [
        cc.id, IDS.CAMPAIGN_A, cc.creatorId, IDS.USER_JACK,
        cc.stage, cc.ingestStatus, cc.scoreStatus,
        ['sent', 'replied', 'drafted', 'booked'].includes(cc.outreachState) ? IDS.USER_ARYA : null,
        cc.outreachState, lastOutreach, cc.nextFollowup,
        NOW, NOW,
      ],
      `cc_${cc.creatorId.slice(-4)}`
    )
  }

  // ---- CONTENT ITEMS ----
  // Nina - 3 items
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'youtube','youtube_video',$4,$5,$6,$7,'en',$8,$9,$10,'seed','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_NINA_1, IDS.CREATOR_NINA, IDS.CAMPAIGN_A,
      'Kubernetes Cost Allocation by Namespace (Hands-on)',
      'https://youtube.com/watch?v=kubecraft-ns-cost-001',
      '2026-01-15 00:00:00Z', NOW, NINA_TRANSCRIPT_1, 320,
      JSON.stringify({ view_count: 124000, duration_seconds: 870, channel: 'KubeCraft' }),
      NOW, NOW,
    ],
    'ci_nina_1'
  )
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'youtube','youtube_video',$4,$5,$6,$7,'en',$8,$9,$10,'seed','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_NINA_2, IDS.CREATOR_NINA, IDS.CAMPAIGN_A,
      'Kubecost vs Custom Dashboards: What\'s Missing',
      'https://youtube.com/watch?v=kubecraft-kubecost-vs-002',
      '2026-01-28 00:00:00Z', NOW, NINA_TRANSCRIPT_2, 285,
      JSON.stringify({ view_count: 87500, duration_seconds: 645, channel: 'KubeCraft' }),
      NOW, NOW,
    ],
    'ci_nina_2'
  )
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'blog','blog_post',$4,$5,$6,$7,'en',$8,$9,$10,'seed','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_NINA_3, IDS.CREATOR_NINA, IDS.CAMPAIGN_A,
      'OpenTelemetry signals for cost attribution',
      'https://kubecraft.dev/blog/otel-cost-attribution',
      '2026-02-05 00:00:00Z', NOW, NINA_BLOG_1, 410,
      JSON.stringify({ estimated_read_minutes: 5 }),
      NOW, NOW,
    ],
    'ci_nina_3'
  )

  // Mei - 2 items
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'youtube','youtube_video',$4,$5,$6,$7,'en',$8,$9,$10,'seed','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_MEI_1, IDS.CREATOR_MEI, IDS.CAMPAIGN_A,
      'OpenTelemetry and Cost Attribution â Observability Lab',
      'https://youtube.com/watch?v=obslab-otel-cost-001',
      '2026-02-01 00:00:00Z', NOW, MEI_TRANSCRIPT_1, 260,
      JSON.stringify({ view_count: 43200, duration_seconds: 680, channel: 'Observability Lab' }),
      NOW, NOW,
    ],
    'ci_mei_1'
  )
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'medium','medium_post',$4,$5,$6,$7,'en',$8,$9,$10,'seed','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_MEI_2, IDS.CREATOR_MEI, IDS.CAMPAIGN_A,
      'Anomaly Detection for Kubernetes Costs',
      'https://medium.com/@mei-tan-otel/anomaly-detection-k8s-costs',
      '2026-01-20 00:00:00Z', NOW, MEI_BLOG_1, 380,
      JSON.stringify({ claps: 1240, estimated_read_minutes: 6 }),
      NOW, NOW,
    ],
    'ci_mei_2'
  )

  // Jae - 2 items
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'youtube','youtube_video',$4,$5,$6,$7,'en',$8,$9,$10,'seed','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_JAE_1, IDS.CREATOR_JAE, IDS.CAMPAIGN_A,
      'SLO-Driven Cost Management in Kubernetes',
      'https://youtube.com/watch?v=srenotes-slo-cost-001',
      '2026-01-30 00:00:00Z', NOW, JAE_TRANSCRIPT_1, 340,
      JSON.stringify({ view_count: 68900, duration_seconds: 820, channel: 'SRE Notes' }),
      NOW, NOW,
    ],
    'ci_jae_1'
  )
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'blog','blog_post',$4,$5,$6,$7,'en',$8,$9,$10,'seed','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_JAE_2, IDS.CREATOR_JAE, IDS.CAMPAIGN_A,
      'Kubernetes resource requests: the hidden cost driver',
      'https://srenotes.dev/resource-requests-cost-driver',
      '2026-02-04 00:00:00Z', NOW, JAE_BLOG_1, 490,
      JSON.stringify({ estimated_read_minutes: 7 }),
      NOW, NOW,
    ],
    'ci_jae_2'
  )

  // K8s Career Hub
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'youtube','youtube_video',$4,$5,$6,$7,'en',$8,$9,$10,'seed','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_K8S_1, IDS.CREATOR_K8S_CAREER, IDS.CAMPAIGN_A,
      'How to Land a $200k Kubernetes Job in 2026',
      'https://youtube.com/watch?v=k8scareerhub-salary-2026',
      '2026-02-10 00:00:00Z', NOW, K8S_CAREER_CONTENT, 180,
      JSON.stringify({ view_count: 298000, duration_seconds: 720, channel: 'K8s Career Hub' }),
      NOW, NOW,
    ],
    'ci_k8s_1'
  )

  // AI Dub
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'youtube','youtube_video',$4,$5,$6,$7,'en',$8,$9,$10,'seed','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_AI_DUB_1, IDS.CREATOR_AI_DUB, IDS.CAMPAIGN_A,
      'Kubernetes Tutorial Kubernetes Tutorial',
      'https://youtube.com/watch?v=aidubtech-k8s-tut-001',
      '2026-02-08 00:00:00Z', NOW, AI_DUB_CONTENT, 140,
      JSON.stringify({ view_count: 8200, duration_seconds: 480, channel: 'AI Dub Tech Channel' }),
      NOW, NOW,
    ],
    'ci_ai_dub_1'
  )

  // Reddit threads
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'reddit','reddit_thread',$4,$5,$6,$7,'en',$8,$9,$10,'fetched','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_REDDIT_1, IDS.CREATOR_NINA, IDS.CAMPAIGN_A,
      'Anyone using CloudForge for cost attribution? Worth it?',
      'https://reddit.com/r/kubernetes/comments/cloudforge_review_2026',
      '2026-02-08 00:00:00Z', NOW, REDDIT_THREAD_1, 180,
      JSON.stringify({ subreddit: 'kubernetes', karma: 847, comment_count: 142, reddit_post_id: 'abc123cloudforge' }),
      NOW, NOW,
    ],
    'ci_reddit_1'
  )
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'reddit','reddit_thread',$4,$5,$6,$7,'en',$8,$9,$10,'fetched','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_REDDIT_2, IDS.CREATOR_MEI, IDS.CAMPAIGN_A,
      'Chargeback vs showback in k8s - what\'s your team doing?',
      'https://reddit.com/r/devops/comments/chargeback_showback_k8s',
      '2026-02-05 00:00:00Z', NOW, REDDIT_THREAD_2, 150,
      JSON.stringify({ subreddit: 'devops', karma: 312, comment_count: 89, reddit_post_id: 'def456chargeback' }),
      NOW, NOW,
    ],
    'ci_reddit_2'
  )
  await run(
    `INSERT INTO content_items (id, creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
     VALUES ($1,$2,$3,'reddit','reddit_thread',$4,$5,$6,$7,'en',$8,$9,$10,'fetched','complete',$11,$12) ON CONFLICT (url) DO NOTHING`,
    [
      IDS.CI_REDDIT_3, IDS.CREATOR_JAE, IDS.CAMPAIGN_A,
      'OpenTelemetry + cost attribution: production experience?',
      'https://reddit.com/r/finops/comments/otel_cost_attribution_prod',
      '2026-02-12 00:00:00Z', NOW, REDDIT_THREAD_3, 170,
      JSON.stringify({ subreddit: 'finops', karma: 521, comment_count: 67, reddit_post_id: 'ghi789otelcost' }),
      NOW, NOW,
    ],
    'ci_reddit_3'
  )

  // ---- EVALUATIONS ----
  // Nina: overall 88, evidence strong
  await run(
    `INSERT INTO creator_evaluations (id, campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit, strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
     VALUES ($1,$2,'anthropic','claude-3-5-sonnet',$3,'strong',false,88,92,87,88,84,86,$4,$5,$6,$7,$8) ON CONFLICT (campaign_creator_id) DO NOTHING`,
    [
      IDS.EVAL_NINA, IDS.CC_NINA, NOW,
      JSON.stringify([
        { text: 'Deep technical depth on namespace cost allocation with actionable recommendations', evidence_snippet_id: IDS.ES_NINA_1 },
        { text: 'Strong OpenTelemetry integration knowledge directly relevant to CloudForge differentiator', evidence_snippet_id: IDS.ES_NINA_3 },
        { text: 'Clearly addresses the SLO â cost trade-off that resonates with DevOps leads', evidence_snippet_id: IDS.ES_NINA_2 },
        { text: 'High-performing channel (124k views on primary video) in exact ICP', evidence_snippet_id: IDS.ES_NINA_4 },
        { text: 'Pragmatic, dev-first tone that aligns with CloudForge brand voice', evidence_snippet_id: IDS.ES_NINA_5 },
      ]),
      JSON.stringify([
        { text: 'Some content skews toward Kubecost-first framing; needs positioning nudge for CloudForge', evidence_snippet_id: IDS.ES_NINA_2 },
        { text: 'Blog presence less prominent than video; outreach draft should emphasize video-first', evidence_snippet_id: null },
      ]),
      `## Nina Patel (KubeCraft) â CloudForge Evaluation

Nina is an exceptional fit for the CloudForge Kubernetes cost optimization campaign. Her content demonstrates rare depth at the intersection of FinOps, SRE, and Kubernetes operations.

**Technical alignment:** Nina's transcript on namespace cost allocation explicitly bridges allocation to SLO riskâexactly the framing CloudForge needs. Her OpenTelemetry blog post is production-ready guidance that mirrors CloudForge's OTel-first positioning.

**Audience fit:** 58k subscribers in the DevOps/Platform Engineering space with strong US + UK GEO match. Engagement metrics (124k views on top video) indicate an active, engaged audience.

**Evidence verdict:** Strong evidence across 3 content items and 4 dimensions. All quotes verified against ingested raw_text. Outreach-ready.`,
      NOW, NOW,
    ],
    'eval_nina'
  )

  // Mei: overall 83, evidence medium
  await run(
    `INSERT INTO creator_evaluations (id, campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit, strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
     VALUES ($1,$2,'anthropic','claude-3-5-sonnet',$3,'medium',false,83,88,82,84,78,80,$4,$5,$6,$7,$8) ON CONFLICT (campaign_creator_id) DO NOTHING`,
    [
      IDS.EVAL_MEI, IDS.CC_MEI, NOW,
      JSON.stringify([
        { text: 'Expert-level OpenTelemetry knowledge with direct cost attribution application', evidence_snippet_id: IDS.ES_MEI_1 },
        { text: 'Per-workload anomaly detection approach directly matches CloudForge use case', evidence_snippet_id: IDS.ES_MEI_2 },
        { text: 'Strong technical credibility as OTel contributor', evidence_snippet_id: null },
      ]),
      JSON.stringify([
        { text: 'Smaller channel (24.5k subs) compared to Nina; lower reach', evidence_snippet_id: null },
        { text: 'Less direct Kubernetes cost tooling coverage; more observability-first angle', evidence_snippet_id: null },
      ]),
      `## Mei Tan (Observability Lab) â CloudForge Evaluation

Mei is a strong technical fit, particularly for the OpenTelemetry + cost attribution angle. Her content is precise, evidence-based, and targets the exact audience asking about OTel + FinOps integration.`,
      NOW, NOW,
    ],
    'eval_mei'
  )

  // Jae: overall 81, evidence medium
  await run(
    `INSERT INTO creator_evaluations (id, campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit, strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
     VALUES ($1,$2,'anthropic','claude-3-5-sonnet',$3,'medium',false,81,85,82,83,76,78,$4,$5,$6,$7,$8) ON CONFLICT (campaign_creator_id) DO NOTHING`,
    [
      IDS.EVAL_JAE, IDS.CC_JAE, NOW,
      JSON.stringify([
        { text: 'Unique SRE-first framing of cost optimization is differentiated and compelling', evidence_snippet_id: IDS.ES_JAE_1 },
        { text: 'Resource requests audit methodology is directly actionable for CloudForge prospects', evidence_snippet_id: IDS.ES_JAE_2 },
        { text: 'Google SRE background adds credibility to cost + reliability claims', evidence_snippet_id: null },
      ]),
      JSON.stringify([
        { text: 'SRE audience may be slightly more reliability-focused than cost-optimization-focused', evidence_snippet_id: null },
        { text: 'Less direct Kubernetes tooling comparison content', evidence_snippet_id: null },
      ]),
      `## Jae Park (SRE Notes) â CloudForge Evaluation

Jae brings a distinctive SRE lens to Kubernetes cost management. The "cost as SLO" framing is unique and differentiatingâit positions CloudForge naturally as the tool that bridges both worlds.`,
      NOW, NOW,
    ],
    'eval_jae'
  )

  // Lucas: overall 74, needs_manual_review=true, evidence weak
  await run(
    `INSERT INTO creator_evaluations (id, campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, needs_manual_review_reason, overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit, strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
     VALUES ($1,$2,'anthropic','claude-3-5-sonnet',$3,'weak',true,$4,74,78,72,74,70,68,$5,$6,$7,$8,$9) ON CONFLICT (campaign_creator_id) DO NOTHING`,
    [
      IDS.EVAL_LUCAS, IDS.CC_LUCAS, NOW,
      'Insufficient evidence: only 1 content item ingested. Creator dormant since Sept 2025. Manual review required before outreach consideration.',
      JSON.stringify([
        { text: 'Content was previously well-aligned with Kubernetes cost optimization', evidence_snippet_id: IDS.ES_LUCAS_1 },
      ]),
      JSON.stringify([
        { text: 'Dormant since September 2025 â no content in 5+ months', evidence_snippet_id: null },
        { text: 'Insufficient evidence coverage for reliable scoring', evidence_snippet_id: null },
        { text: 'Channel performance metrics unavailable due to dormancy', evidence_snippet_id: null },
      ]),
      `## Lucas Varga (Cloud Cost Clinic) â CloudForge Evaluation

**â  Needs Manual Review:** Lucas has been dormant since September 2025. Only 1 content item available for evaluation. Evidence coverage is weak. Score of 74 is below threshold. Manual review required to determine if outreach is appropriate given the dormancy risk.`,
      NOW, NOW,
    ],
    'eval_lucas'
  )

  // ---- EVIDENCE SNIPPETS ----
  // Nina snippets (6)
  const ninaSnippets: [string, string, string, number | null, number | null, string, string, string][] = [
    [IDS.ES_NINA_1, IDS.EVAL_NINA, IDS.CI_NINA_1, 312, 330,
      'Cost allocation per namespace is only step oneâwhat matters is tying that spend to SLO risk.',
      'technical_relevance', 'Directly demonstrates understanding of cost-reliability couplingâcore CloudForge value proposition.'],
    [IDS.ES_NINA_2, IDS.EVAL_NINA, IDS.CI_NINA_2, 240, 260,
      'Kubecost is great for allocation, but it won\'t tell you which deployment caused the spike without additional context.',
      'technical_relevance', 'Identifies the gap that CloudForge fillsâdeployment-level context for cost anomalies.'],
    [IDS.ES_NINA_3, IDS.EVAL_NINA, IDS.CI_NINA_3, null, null,
      'If you can tag spans to workloads, you can attribute cost to ownership boundaries.',
      'technical_relevance', 'Demonstrates OpenTelemetry cost attribution knowledgeâdirectly relevant to CloudForge\'s OTel integration.'],
    [IDS.ES_NINA_4, IDS.EVAL_NINA, IDS.CI_NINA_1, 420, 460,
      'label your namespaces by team and service tier. This makes showback possible and chargeback tractable.',
      'audience_alignment', 'Prescriptive, practical advice targeting Platform Engineers and DevOps Leadsâthe exact CloudForge ICP.'],
    [IDS.ES_NINA_5, IDS.EVAL_NINA, IDS.CI_NINA_2, 480, 510,
      'My recommendation: start with Kubecost for the 80% case, then build custom queries for the spikes and anomalies that matter most.',
      'content_quality', 'Shows balanced, opinionated technical guidanceâbrand-fit voice that resonates as pragmatic and dev-first.'],
    [IDS.ES_NINA_6, IDS.EVAL_NINA, IDS.CI_NINA_1, 540, 570,
      'Tools like Kubecost give you the allocation view. But allocation without reliability context is just a number.',
      'brand_fit', 'Framing reinforces the CloudForge positioning that cost alone is insufficient without operational context.'],
  ]
  for (const [id, evalId, ciId, tsStart, tsEnd, quote, dim, why] of ninaSnippets) {
    await run(
      `INSERT INTO evidence_snippets (id, evaluation_id, content_item_id, timestamp_start_seconds, timestamp_end_seconds, quote, dimension, why_it_matters, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [id, evalId, ciId, tsStart, tsEnd, quote, dim, why, NOW],
      `es_nina_${id.slice(-4)}`
    )
  }

  // Mei snippets (3)
  const meiSnippets: [string, string, string, number | null, number | null, string, string, string][] = [
    [IDS.ES_MEI_1, IDS.EVAL_MEI, IDS.CI_MEI_1, 135, 150,
      'OpenTelemetry gives you the metadata hooks; cost attribution is a mapping problem, not a metrics problem.',
      'technical_relevance', 'Reframes OTel cost attribution preciselyâmatches CloudForge\'s integration narrative.'],
    [IDS.ES_MEI_2, IDS.EVAL_MEI, IDS.CI_MEI_2, null, null,
      'Anomaly detection works best when you baseline per workload and per namespace.',
      'technical_relevance', 'Per-workload baselining matches CloudForge\'s cost anomaly detection feature description exactly.'],
    [IDS.ES_MEI_3, IDS.EVAL_MEI, IDS.CI_MEI_1, 310, 330,
      'Don\'t. Extend your existing OTel pipeline.',
      'content_quality', 'Concise, opinionated advice demonstrating depth of OTel operational expertise.'],
  ]
  for (const [id, evalId, ciId, tsStart, tsEnd, quote, dim, why] of meiSnippets) {
    await run(
      `INSERT INTO evidence_snippets (id, evaluation_id, content_item_id, timestamp_start_seconds, timestamp_end_seconds, quote, dimension, why_it_matters, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [id, evalId, ciId, tsStart, tsEnd, quote, dim, why, NOW],
      `es_mei_${id.slice(-4)}`
    )
  }

  // Jae snippets (3)
  const jaeSnippets: [string, string, string, number | null, number | null, string, string, string][] = [
    [IDS.ES_JAE_1, IDS.EVAL_JAE, IDS.CI_JAE_1, 224, 240,
      'You cannot optimize cost in isolation from reliabilityâevery budget decision is also an SLO decision.',
      'technical_relevance', 'Unique SRE framing of FinOpsâpositions cost optimization as SRE work, not just finance.'],
    [IDS.ES_JAE_2, IDS.EVAL_JAE, IDS.CI_JAE_2, null, null,
      'Over-provisioned resource requests are the single biggest source of wasted cloud spend in most Kubernetes clusters.',
      'technical_relevance', 'Identifies the #1 cost driver with authorityâcreates urgency for CloudForge\'s rightsizing recommendations.'],
    [IDS.ES_JAE_3, IDS.EVAL_JAE, IDS.CI_JAE_1, 480, 510,
      'treat cost optimization as an SRE task, not a FinOps task',
      'audience_alignment', 'Speaks directly to SRE and DevOps Lead audienceâexactly CloudForge\'s DevOps Lead persona.'],
  ]
  for (const [id, evalId, ciId, tsStart, tsEnd, quote, dim, why] of jaeSnippets) {
    await run(
      `INSERT INTO evidence_snippets (id, evaluation_id, content_item_id, timestamp_start_seconds, timestamp_end_seconds, quote, dimension, why_it_matters, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [id, evalId, ciId, tsStart, tsEnd, quote, dim, why, NOW],
      `es_jae_${id.slice(-4)}`
    )
  }

  // Lucas snippet (1 - weak)
  await run(
    `INSERT INTO evidence_snippets (id, evaluation_id, content_item_id, timestamp_start_seconds, timestamp_end_seconds, quote, dimension, why_it_matters, created_at)
     VALUES ($1,$2,$3,null,null,$4,'technical_relevance',$5,$6) ON CONFLICT DO NOTHING`,
    [
      IDS.ES_LUCAS_1, IDS.EVAL_LUCAS, IDS.CI_AI_DUB_1,
      'Kubernetes Tutorial Kubernetes Tutorial Kubernetes Tutorial',
      'Only available content is low-quality autodubbed material. Insufficient for reliable scoring.',
      NOW,
    ],
    'es_lucas_1'
  )

  // ---- RECOMMENDED CONTENT ----
  // Nina
  const rcNina: [string, string, string, number][] = [
    [IDS.EVAL_NINA, IDS.CI_NINA_1, 'high', 1],
    [IDS.EVAL_NINA, IDS.CI_NINA_2, 'high', 2],
    [IDS.EVAL_NINA, IDS.CI_NINA_3, 'medium', 3],
  ]
  for (const [evalId, ciId, bucket, rank] of rcNina) {
    await run(
      `INSERT INTO evaluation_recommended_content (id, evaluation_id, content_item_id, bucket, relevance_rank, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5) ON CONFLICT (evaluation_id, content_item_id) DO NOTHING`,
      [evalId, ciId, bucket, rank, NOW],
      `rc_nina_${rank}`
    )
  }
  // Mei
  for (const [ciId, bucket, rank] of [[IDS.CI_MEI_1, 'high', 1], [IDS.CI_MEI_2, 'medium', 2]] as [string, string, number][]) {
    await run(
      `INSERT INTO evaluation_recommended_content (id, evaluation_id, content_item_id, bucket, relevance_rank, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5) ON CONFLICT (evaluation_id, content_item_id) DO NOTHING`,
      [IDS.EVAL_MEI, ciId, bucket, rank, NOW],
      `rc_mei_${rank}`
    )
  }
  // Jae
  for (const [ciId, bucket, rank] of [[IDS.CI_JAE_1, 'high', 1], [IDS.CI_JAE_2, 'medium', 2]] as [string, string, number][]) {
    await run(
      `INSERT INTO evaluation_recommended_content (id, evaluation_id, content_item_id, bucket, relevance_rank, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5) ON CONFLICT (evaluation_id, content_item_id) DO NOTHING`,
      [IDS.EVAL_JAE, ciId, bucket, rank, NOW],
      `rc_jae_${rank}`
    )
  }

  // ---- CONTENT ANGLES ----
  // Nina angles (3)
  const ninaAngles = [
    {
      id: IDS.ANGLE_NINA_1, title: 'Hands-on CloudForge Setup: Namespace Cost Allocation in 30 Minutes',
      format: 'tutorial', persona: 'DevOps Lead', selected: true,
      keys: ['Install CloudForge via Helm', 'Configure namespace labels', 'Set up cost alerts', 'Export to Grafana dashboard'],
    },
    {
      id: IDS.ANGLE_NINA_2, title: 'Kubecost vs CloudForge: Where Each Tool Falls Short',
      format: 'comparison', persona: 'Platform Engineer', selected: false,
      keys: ['Allocation coverage comparison', 'Deployment-level context gap', 'OpenTelemetry integration', 'Multi-cloud support'],
    },
    {
      id: IDS.ANGLE_NINA_3, title: 'OpenTelemetry + CloudForge: Cost Attribution at the Span Level',
      format: 'architecture', persona: 'Platform Engineer', selected: false,
      keys: ['OTel resource attributes for cost', 'CloudForge OTel collector config', 'Span-to-cost mapping', 'Dashboard setup'],
    },
  ]
  for (const a of ninaAngles) {
    await run(
      `INSERT INTO content_angles (id, evaluation_id, title, target_prompt_gap_id, persona, format, key_points_json, selected_for_outreach, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [a.id, IDS.EVAL_NINA, a.title, IDS.PG_1, a.persona, a.format, JSON.stringify(a.keys), a.selected, NOW],
      `angle_nina_${a.id.slice(-4)}`
    )
  }

  // Mei angles (2)
  const meiAngles = [
    {
      id: IDS.ANGLE_MEI_1, title: 'OpenTelemetry Signals for Kubernetes Cost Attribution',
      format: 'architecture', persona: 'Platform Engineer',
      keys: ['OTel metadata hooks for cost', 'Mapping OTel to cost dimensions', 'CloudForge OTel integration walkthrough'],
    },
    {
      id: IDS.ANGLE_MEI_2, title: 'Per-Workload Cost Anomaly Detection with CloudForge',
      format: 'tutorial', persona: 'DevOps Lead',
      keys: ['Per-workload baselining setup', 'CloudForge anomaly thresholds', 'Alert routing', 'Incident correlation'],
    },
  ]
  for (const a of meiAngles) {
    await run(
      `INSERT INTO content_angles (id, evaluation_id, title, persona, format, key_points_json, selected_for_outreach, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,false,$7) ON CONFLICT DO NOTHING`,
      [a.id, IDS.EVAL_MEI, a.title, a.persona, a.format, JSON.stringify(a.keys), NOW],
      `angle_mei_${a.id.slice(-4)}`
    )
  }

  // Jae angles (2)
  const jaeAngles = [
    {
      id: IDS.ANGLE_JAE_1, title: 'SLO-Aware Cost Optimization: The SRE Approach',
      format: 'deep_dive', persona: 'DevOps Lead',
      keys: ['Model cost and error budgets together', 'Right-sizing with reliability guardrails', 'CloudForge SLO overlay', 'Case study: 40% cost reduction without SLO violation'],
    },
    {
      id: IDS.ANGLE_JAE_2, title: 'Kubernetes Resource Request Audit: Find Hidden Cloud Waste',
      format: 'tutorial', persona: 'DevOps Lead',
      keys: ['30-day usage audit methodology', 'Right-sizing in stages', 'CloudForge recommendations integration', 'Automated rightsizing alerts'],
    },
  ]
  for (const a of jaeAngles) {
    await run(
      `INSERT INTO content_angles (id, evaluation_id, title, persona, format, key_points_json, selected_for_outreach, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,false,$7) ON CONFLICT DO NOTHING`,
      [a.id, IDS.EVAL_JAE, a.title, a.persona, a.format, JSON.stringify(a.keys), NOW],
      `angle_jae_${a.id.slice(-4)}`
    )
  }

  // ---- ANGLE EVIDENCE ----
  const angleEvidence: [string, string][] = [
    [IDS.ANGLE_NINA_1, IDS.ES_NINA_1],
    [IDS.ANGLE_NINA_1, IDS.ES_NINA_4],
    [IDS.ANGLE_NINA_2, IDS.ES_NINA_2],
    [IDS.ANGLE_NINA_2, IDS.ES_NINA_5],
    [IDS.ANGLE_NINA_3, IDS.ES_NINA_3],
    [IDS.ANGLE_NINA_3, IDS.ES_NINA_6],
    [IDS.ANGLE_MEI_1, IDS.ES_MEI_1],
    [IDS.ANGLE_MEI_2, IDS.ES_MEI_2],
    [IDS.ANGLE_JAE_1, IDS.ES_JAE_1],
    [IDS.ANGLE_JAE_1, IDS.ES_JAE_3],
    [IDS.ANGLE_JAE_2, IDS.ES_JAE_2],
  ]
  for (const [angleId, esId] of angleEvidence) {
    await run(
      `INSERT INTO angle_evidence (id, angle_id, evidence_snippet_id, created_at) VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT DO NOTHING`,
      [angleId, esId, NOW],
      `ae_${angleId.slice(-4)}_${esId.slice(-4)}`
    )
  }

  // ---- HUMAN REVIEWS ----
  await run(
    `INSERT INTO human_reviews (id, campaign_creator_id, reviewed_by_user_id, reviewed_at, decision, notes_md, created_at)
     VALUES ($1,$2,$3,$4,'approved_for_outreach','Strong evidence, excellent technical fit. Approved for outreach with tutorial angle.',$5) ON CONFLICT DO NOTHING`,
    [IDS.HR_NINA, IDS.CC_NINA, IDS.USER_JACK, WEEK_AGO, NOW], 'hr_nina'
  )
  await run(
    `INSERT INTO human_reviews (id, campaign_creator_id, reviewed_by_user_id, reviewed_at, decision, notes_md, created_at)
     VALUES ($1,$2,$3,$4,'approved_for_outreach','SRE angle is unique. Approved for SLO-driven cost angle outreach.',$5) ON CONFLICT DO NOTHING`,
    [IDS.HR_JAE, IDS.CC_JAE, IDS.USER_JACK, WEEK_AGO, NOW], 'hr_jae'
  )
  await run(
    `INSERT INTO human_reviews (id, campaign_creator_id, reviewed_by_user_id, reviewed_at, decision, notes_md, created_at)
     VALUES ($1,$2,$3,$4,'needs_manual_review','Dormant since Sept 2025. Insufficient evidence. Flag for manual checkâreach out only if they publish again.',$5) ON CONFLICT DO NOTHING`,
    [IDS.HR_LUCAS, IDS.CC_LUCAS, IDS.USER_JACK, WEEK_AGO, NOW], 'hr_lucas'
  )
  await run(
    `INSERT INTO human_reviews (id, campaign_creator_id, reviewed_by_user_id, reviewed_at, decision, notes_md, created_at)
     VALUES ($1,$2,$3,$4,'excluded','Career/lifestyle content. Not relevant to CloudForge ICP. Exclude from all outreach.',$5) ON CONFLICT DO NOTHING`,
    [IDS.HR_K8S, IDS.CC_K8S_CAREER, IDS.USER_JACK, WEEK_AGO, NOW], 'hr_k8s'
  )

  // ---- OUTREACH PACKETS ----
  const ninaFollowup = [
    { channel: 'email', label: 'Follow-up email', day_offset: 2, completed: true },
    { channel: 'email', label: 'Second follow-up email', day_offset: 5, completed: false },
    { channel: 'email', label: 'Final email', day_offset: 9, completed: false },
    { channel: 'linkedin', label: 'LinkedIn connection + note', day_offset: 2, completed: true },
    { channel: 'linkedin', label: 'LinkedIn follow-up', day_offset: 5, completed: false },
    { channel: 'x', label: 'X reply / mention (optional)', day_offset: 5, completed: false },
  ]
  await run(
    `INSERT INTO outreach_packets (id, campaign_creator_id, created_by_user_id, subject, body_md, selected_angle_id, followup_plan_json, last_updated_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (campaign_creator_id) DO NOTHING`,
    [
      IDS.OP_NINA, IDS.CC_NINA, IDS.USER_ARYA,
      'Collaboration: Hands-on CloudForge + Kubernetes Cost Optimization',
      `Hi Nina,

I came across your video on **Kubernetes Cost Allocation by Namespace** â your point about cost allocation being "only step one" and the need to tie spend to SLO risk is exactly the framing our audience resonates with.

I'm reaching out on behalf of **CloudForge**, a Kubernetes cost optimization platform that does exactly this: it shows cost drivers per namespace and workload, with actionable recommendations tied to reliability context.

Given your content on [Kubecost vs Custom Dashboards](https://youtube.com/watch?v=kubecraft-kubecost-vs-002) and your OTel blog post, I think a hands-on CloudForge tutorial would land extremely well with your audience.

**What we're proposing:**
- A hands-on tutorial: "Namespace Cost Allocation in 30 Minutes with CloudForge"
- Market rate sponsorship (we're flexible on format)
- CloudForge free tier access for your setup and review

Would you be open to a brief call this week to explore?

Best,
Arya
Creator Partnerships, CloudForge`,
      IDS.ANGLE_NINA_1,
      JSON.stringify(ninaFollowup),
      WEEK_AGO, WEEK_AGO,
    ],
    'op_nina'
  )

  const jaeFollowup = [
    { channel: 'email', label: 'Follow-up email', day_offset: 2, completed: false },
    { channel: 'email', label: 'Second follow-up', day_offset: 5, completed: false },
    { channel: 'linkedin', label: 'LinkedIn note', day_offset: 2, completed: false },
  ]
  await run(
    `INSERT INTO outreach_packets (id, campaign_creator_id, created_by_user_id, subject, body_md, selected_angle_id, followup_plan_json, last_updated_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (campaign_creator_id) DO NOTHING`,
    [
      IDS.OP_JAE, IDS.CC_JAE, IDS.USER_ARYA,
      'Collaboration idea: SLO-Aware Kubernetes Cost Optimization (CloudForge)',
      `Hi Jae,

Your take that **"every budget decision is also an SLO decision"** is something I haven't seen anyone in the Kubernetes space articulate as clearly â it resonates deeply with the platform engineering teams we work with.

I'm from **CloudForge**, a Kubernetes cost optimization tool built for SRE-minded teams. Our cost anomaly detection and namespace-level recommendations are specifically designed to help teams right-size without burning their error budget.

Given your audience of SREs and DevOps leads, I think a **"SLO-Aware Cost Optimization with CloudForge"** deep dive would be a hit.

**Proposed format:**
- 15-20 minute deep dive (your style)
- Market rate sponsorship
- We'll provide a test environment with pre-loaded cost scenarios

Interested in exploring?

Best,
Arya`,
      IDS.ANGLE_JAE_1,
      JSON.stringify(jaeFollowup),
      WEEK_AGO, WEEK_AGO,
    ],
    'op_jae'
  )

  // ---- OUTREACH PACKET EVIDENCE ----
  await run(
    `INSERT INTO outreach_packet_evidence (id, outreach_packet_id, evidence_snippet_id, created_at)
     VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT DO NOTHING`,
    [IDS.OP_NINA, IDS.ES_NINA_1, NOW], 'ope_nina_1'
  )
  await run(
    `INSERT INTO outreach_packet_evidence (id, outreach_packet_id, evidence_snippet_id, created_at)
     VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT DO NOTHING`,
    [IDS.OP_NINA, IDS.ES_NINA_2, NOW], 'ope_nina_2'
  )
  await run(
    `INSERT INTO outreach_packet_evidence (id, outreach_packet_id, evidence_snippet_id, created_at)
     VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT DO NOTHING`,
    [IDS.OP_NINA, IDS.ES_NINA_3, NOW], 'ope_nina_3'
  )
  await run(
    `INSERT INTO outreach_packet_evidence (id, outreach_packet_id, evidence_snippet_id, created_at)
     VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT DO NOTHING`,
    [IDS.OP_JAE, IDS.ES_JAE_1, NOW], 'ope_jae_1'
  )
  await run(
    `INSERT INTO outreach_packet_evidence (id, outreach_packet_id, evidence_snippet_id, created_at)
     VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT DO NOTHING`,
    [IDS.OP_JAE, IDS.ES_JAE_2, NOW], 'ope_jae_2'
  )

  // ---- OUTREACH ACTIVITY ----
  // Nina: sent (email) + followup_sent (linkedin)
  await run(
    `INSERT INTO outreach_activity (id, campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at, notes)
     VALUES (gen_random_uuid(),$1,$2,'email','sent','sent',$3,'Initial outreach email sent via Gmail.') ON CONFLICT DO NOTHING`,
    [IDS.CC_NINA, IDS.USER_ARYA, WEEK_AGO], 'oa_nina_sent'
  )
  await run(
    `INSERT INTO outreach_activity (id, campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at, notes)
     VALUES (gen_random_uuid(),$1,$2,'linkedin','followup_sent','sent',$3,'Sent LinkedIn connection request with note.') ON CONFLICT DO NOTHING`,
    [IDS.CC_NINA, IDS.USER_ARYA, NOW], 'oa_nina_linkedin'
  )
  // Jae: sent + reply_logged + state_changed
  await run(
    `INSERT INTO outreach_activity (id, campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at, notes)
     VALUES (gen_random_uuid(),$1,$2,'email','sent','sent',$3,'Initial outreach email sent.') ON CONFLICT DO NOTHING`,
    [IDS.CC_JAE, IDS.USER_ARYA, WEEK_AGO], 'oa_jae_sent'
  )
  await run(
    `INSERT INTO outreach_activity (id, campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at, notes)
     VALUES (gen_random_uuid(),$1,$2,'email','reply_logged','replied',$3,'Jae replied â interested, wants to see product demo first.') ON CONFLICT DO NOTHING`,
    [IDS.CC_JAE, IDS.USER_ARYA, NOW], 'oa_jae_reply'
  )
  await run(
    `INSERT INTO outreach_activity (id, campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at, notes)
     VALUES (gen_random_uuid(),$1,$2,'email','state_changed','replied',$3,'State updated to replied after Jae''s response.') ON CONFLICT DO NOTHING`,
    [IDS.CC_JAE, IDS.USER_ARYA, NOW], 'oa_jae_state'
  )
  // Marta: sent + state_changed to booked
  await run(
    `INSERT INTO outreach_activity (id, campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at, notes)
     VALUES (gen_random_uuid(),$1,$2,'email','sent','sent',$3,'Initial outreach email sent to Marta.') ON CONFLICT DO NOTHING`,
    [IDS.CC_MARTA, IDS.USER_ARYA, WEEK_AGO], 'oa_marta_sent'
  )
  await run(
    `INSERT INTO outreach_activity (id, campaign_creator_id, performed_by_user_id, channel, action_type, state_after, occurred_at, notes)
     VALUES (gen_random_uuid(),$1,$2,'email','state_changed','booked',$3,'Marta confirmed. Contract signed. Recording date TBD.') ON CONFLICT DO NOTHING`,
    [IDS.CC_MARTA, IDS.USER_ARYA, NOW], 'oa_marta_booked'
  )

  // ---- ACTIVITY LOG ----
  const activityEvents = [
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_NINA, cc: IDS.CC_NINA, actor: IDS.USER_JACK, event: 'scoring_complete', data: { score: 88, coverage: 'strong' } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_MEI, cc: IDS.CC_MEI, actor: IDS.USER_JACK, event: 'scoring_complete', data: { score: 83, coverage: 'medium' } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_JAE, cc: IDS.CC_JAE, actor: IDS.USER_JACK, event: 'scoring_complete', data: { score: 81, coverage: 'medium' } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_LUCAS, cc: IDS.CC_LUCAS, actor: IDS.USER_JACK, event: 'scoring_complete', data: { score: 74, coverage: 'weak', needs_manual_review: true } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_NINA, cc: IDS.CC_NINA, actor: IDS.USER_JACK, event: 'review_decision', data: { decision: 'approved_for_outreach' } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_JAE, cc: IDS.CC_JAE, actor: IDS.USER_JACK, event: 'review_decision', data: { decision: 'approved_for_outreach' } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_LUCAS, cc: IDS.CC_LUCAS, actor: IDS.USER_JACK, event: 'review_decision', data: { decision: 'needs_manual_review' } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_K8S_CAREER, cc: IDS.CC_K8S_CAREER, actor: IDS.USER_JACK, event: 'review_decision', data: { decision: 'excluded' } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_NINA, cc: IDS.CC_NINA, actor: IDS.USER_ARYA, event: 'outreach_sent', data: { channel: 'email', state: 'sent' } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_JAE, cc: IDS.CC_JAE, actor: IDS.USER_ARYA, event: 'outreach_replied', data: { channel: 'email', state: 'replied' } },
    { campaign: IDS.CAMPAIGN_A, creator: IDS.CREATOR_MARTA, cc: IDS.CC_MARTA, actor: IDS.USER_ARYA, event: 'creator_booked', data: { channel: 'email', state: 'booked' } },
    { campaign: IDS.CAMPAIGN_A, creator: null, cc: null, actor: IDS.USER_JACK, event: 'search_terms_approved', data: { count: 15 } },
  ]
  for (const e of activityEvents) {
    await run(
      `INSERT INTO activity_log (id, campaign_id, creator_id, campaign_creator_id, actor_user_id, event_type, event_data_json, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [e.campaign, e.creator, e.cc, e.actor, e.event, JSON.stringify(e.data), NOW],
      `al_${e.event}_${(e.creator || 'campaign').slice(-4)}`
    )
  }

  // ---- DEMO SEED RUNS ----
  await run(
    `INSERT INTO demo_seed_runs (id, seed_version, seeded_at, seeded_by_user_id, notes)
     VALUES (gen_random_uuid(),'v0-demo-1',$1,$2,'Initial v0 demo dataset') ON CONFLICT DO NOTHING`,
    [NOW, IDS.USER_EMPROMPTU], 'seed_run'
  )

  return { inserted, errors }
}
