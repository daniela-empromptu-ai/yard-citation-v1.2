import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/seed-demo?platform=youtube — delete creators (and linked data) for a platform.
 * DELETE /api/seed-demo — delete ALL seeded data.
 */
export async function DELETE(req: NextRequest) {
  try {
    const platform = new URL(req.url).searchParams.get('platform')
    const where = platform ? `WHERE platform = '${platform}'` : ''
    const creatorIds = await dbQuery<{ id: string }>(`SELECT id FROM creators ${where}`, [])
    const ids = creatorIds.data.map(r => r.id)
    if (ids.length === 0) return NextResponse.json({ message: 'No creators to delete' })

    // Delete linked data in FK order
    for (const id of ids) {
      // evaluations → need campaign_creator_ids first
      const ccRows = await dbQuery<{ id: string }>('SELECT id FROM campaign_creators WHERE creator_id = $1', [id])
      for (const cc of ccRows.data) {
        await dbQuery('DELETE FROM evidence_snippets WHERE evaluation_id IN (SELECT id FROM creator_evaluations WHERE campaign_creator_id = $1)', [cc.id])
        await dbQuery('DELETE FROM content_angles WHERE evaluation_id IN (SELECT id FROM creator_evaluations WHERE campaign_creator_id = $1)', [cc.id])
        await dbQuery('DELETE FROM creator_evaluations WHERE campaign_creator_id = $1', [cc.id])
      }
      await dbQuery('DELETE FROM campaign_creators WHERE creator_id = $1', [id])
      await dbQuery('DELETE FROM content_items WHERE creator_id = $1', [id])
      await dbQuery('DELETE FROM creator_categories WHERE creator_id = $1', [id])
      await dbQuery('DELETE FROM activity_log WHERE creator_id = $1', [id])
      await dbQuery('DELETE FROM creators WHERE id = $1', [id])
    }

    // If deleting all, also clean campaigns and remaining activity
    if (!platform) {
      await dbQuery('DELETE FROM activity_log', [])
      await dbQuery('DELETE FROM campaign_search_terms', [])
      await dbQuery('DELETE FROM campaign_topics', [])
      await dbQuery('DELETE FROM campaigns', [])
    }

    return NextResponse.json({ deleted: ids.length, platform: platform || 'all' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * One-shot demo seed: populates creators, campaigns, evaluations, content, activity.
 * Hit GET /api/seed-demo to run. Idempotent — skips if creators already exist.
 */
export async function GET() {
  try {
    // Guard: skip if YouTube creators already exist AND campaigns exist
    const ytCount = await dbQuery<{ count: string }>("SELECT COUNT(*) as count FROM creators WHERE platform = 'youtube'", [])
    const campCount = await dbQuery<{ count: string }>('SELECT COUNT(*) as count FROM campaigns', [])
    if (parseInt(ytCount.data[0]?.count || '0') > 0 && parseInt(campCount.data[0]?.count || '0') > 0) {
      return NextResponse.json({ message: 'Already seeded — delete YouTube creators and campaigns first to re-seed.' })
    }

    // ── Fetch existing reference data ──────────────────────────────
    const catRows = await dbQuery<{ id: string; name: string }>('SELECT id, name FROM categories', [])
    const catMap: Record<string, string> = {}
    for (const c of catRows.data) catMap[c.name] = c.id

    const userRows = await dbQuery<{ id: string; name: string }>('SELECT id, name FROM app_users ORDER BY created_at LIMIT 1', [])
    const userId = userRows.data[0]?.id
    if (!userId) return NextResponse.json({ error: 'No app_users found' }, { status: 500 })

    const clientRows = await dbQuery<{ id: string }>('SELECT id FROM clients LIMIT 1', [])
    const clientId = clientRows.data[0]?.id
    if (!clientId) return NextResponse.json({ error: 'No clients found' }, { status: 500 })

    // ── Creator definitions ────────────────────────────────────────
    const creators = [
      // YouTube creators (verified via YouTube Data API)
      { name: 'DevOps & AI Toolkit', platform: 'youtube', handle: 'devopstoolkit', url: 'https://youtube.com/@devopstoolkit', subscriber_count: 94800, relationship_status: 'warm', categories: ['DevOps & SRE', 'Kubernetes & Containers', 'AI & Machine Learning'], notes: 'Viktor Farcic & Darin Pope. 500+ videos on DevOps tooling. Publishes 2-3x/week.' },
      { name: 'TechWorld with Nana', platform: 'youtube', handle: 'techworldwithnana', url: 'https://youtube.com/@techworldwithnana', subscriber_count: 1420000, relationship_status: 'cold', categories: ['DevOps & SRE', 'Cloud Infrastructure'], notes: 'Nana Janashia. 1.4M subs. Beginner-friendly DevOps & cloud tutorials.' },
      { name: 'Bret Fisher', platform: 'youtube', handle: 'bretfisher', url: 'https://youtube.com/@bretfisher', subscriber_count: 80700, relationship_status: 'warm', categories: ['DevOps & SRE', 'Kubernetes & Containers'], notes: 'Docker Captain & Cloud Native Ambassador. Containers, K8s, GitOps, DevSecOps.' },
      { name: 'NetworkChuck', platform: 'youtube', handle: 'networkchuck', url: 'https://youtube.com/@networkchuck', subscriber_count: 5160000, relationship_status: 'none', categories: ['Cybersecurity', 'Cloud Infrastructure'], notes: '5.1M subs. Broad IT/networking/security audience. Very beginner-oriented.' },
      { name: 'Techno Tim', platform: 'youtube', handle: 'technotim', url: 'https://youtube.com/@technotim', subscriber_count: 322000, relationship_status: 'cold', categories: ['DevOps & SRE', 'Cloud Infrastructure', 'Kubernetes & Containers'], notes: '322K subs. Homelab + enterprise crossover. Self-hosting, K8s, infrastructure.' },
      { name: 'Fireship', platform: 'youtube', handle: 'fireship', url: 'https://youtube.com/@fireship', subscriber_count: 4120000, relationship_status: 'none', categories: ['Software Engineering', 'Developer Tools'], notes: '4.1M subs. Short-form tech explainers. "X in 100 seconds" format.' },
      { name: 'Rawkode Academy', platform: 'youtube', handle: 'rawkodeacademy', url: 'https://youtube.com/@rawkodeacademy', subscriber_count: 28300, relationship_status: 'warm', categories: ['DevOps & SRE', 'Platform Engineering', 'Kubernetes & Containers'], notes: 'David McKay. 414 videos. Strong CNCF community connections.' },
      { name: 'That DevOps Guy', platform: 'youtube', handle: 'marceldempers', url: 'https://youtube.com/@marceldempers', subscriber_count: 89400, relationship_status: 'cold', categories: ['DevOps & SRE', 'Kubernetes & Containers'], notes: 'Marcel Dempers. Practical K8s & DevOps walkthroughs. Based in Australia.' },
      { name: 'Anton Putra', platform: 'youtube', handle: 'antonputra', url: 'https://youtube.com/@antonputra', subscriber_count: 117000, relationship_status: 'warm', categories: ['DevOps & SRE', 'Cloud Infrastructure', 'Observability'], notes: '117K subs. Infrastructure cost comparisons & monitoring deep dives.' },
      { name: 'Abhishek Veeramalla', platform: 'youtube', handle: 'abhishekveeramalla', url: 'https://youtube.com/@abhishekveeramalla', subscriber_count: 595000, relationship_status: 'hot', categories: ['DevOps & SRE', 'Cloud Infrastructure', 'Kubernetes & Containers'], notes: '595K subs, 733 videos. Comprehensive DevOps tutorials. Based in India.' },

      // Medium creators
      { name: 'Cindy Sridharan', platform: 'medium', handle: 'copyconstruct', url: 'https://medium.com/@copyconstruct', subscriber_count: null, relationship_status: 'cold', categories: ['Observability', 'Software Engineering'], notes: 'Distributed systems expert. "Monitoring and Observability" author.' },
      { name: 'Jaana Dogan', platform: 'medium', handle: 'rakyll', url: 'https://medium.com/@rakyll', subscriber_count: null, relationship_status: 'none', categories: ['Software Engineering', 'Cloud Infrastructure'], notes: 'Ex-Google. Deep Go + cloud-native expertise.' },
      { name: 'Gergely Orosz', platform: 'medium', handle: 'gergelyorosz', url: 'https://medium.com/@gergelyorosz', subscriber_count: null, relationship_status: 'warm', categories: ['Software Engineering', 'Platform Engineering'], notes: 'The Pragmatic Engineer. Huge newsletter crossover.' },
      { name: 'Ioannis Canellos', platform: 'medium', handle: 'iocanel', url: 'https://medium.com/@iocanel', subscriber_count: null, relationship_status: 'cold', categories: ['Kubernetes & Containers', 'Developer Tools'], notes: 'Red Hat engineer. Quarkus + K8s deep dives.' },
      { name: 'Pavan Belagatti', platform: 'medium', handle: 'pavanbelagatti', url: 'https://medium.com/@pavanbelagatti', subscriber_count: null, relationship_status: 'warm', categories: ['DevOps & SRE', 'AI & Machine Learning'], notes: 'DevOps + AI intersection content. High publishing cadence.' },
      { name: 'Liz Rice', platform: 'medium', handle: 'lizrice', url: 'https://medium.com/@lizrice', subscriber_count: null, relationship_status: 'hot', categories: ['Cybersecurity', 'Kubernetes & Containers'], notes: 'Isovalent CTO. eBPF pioneer. Conference keynote regular.' },
      { name: 'William Morgan', platform: 'medium', handle: 'wm', url: 'https://medium.com/@wm', subscriber_count: null, relationship_status: 'cold', categories: ['Platform Engineering', 'Kubernetes & Containers'], notes: 'Linkerd creator. Service mesh thought leader.' },
      { name: 'Kasun Rajapakse', platform: 'medium', handle: 'krazyguru', url: 'https://medium.com/@krazyguru', subscriber_count: null, relationship_status: 'none', categories: ['Cloud Infrastructure', 'DevOps & SRE'], notes: 'AWS + Terraform tutorials. Practical IaC content.' },
    ]

    // ── Insert creators + categories ───────────────────────────────
    const creatorIds: Record<string, string> = {} // name+platform → id

    for (const cr of creators) {
      // Check if creator already exists (e.g. Medium creators from prior seed)
      const existingCreator = await dbQuery<{ id: string }>(
        'SELECT id FROM creators WHERE handle=$1 AND platform=$2 LIMIT 1',
        [cr.handle, cr.platform]
      )
      if (existingCreator.data.length === 0) {
        await dbQuery(
          `INSERT INTO creators (name, display_name, platform, handle, url, subscriber_count, content_language, relationship_status, notes, discovered_via, created_at, updated_at)
           VALUES ($1,$1,$2,$3,$4,$5,'English',$6,$7,'manual',now(),now())`,
          [cr.name, cr.platform, cr.handle, cr.url, cr.subscriber_count, cr.relationship_status, cr.notes]
        )
      }

      const fetched = await dbQuery<{ id: string }>(
        'SELECT id FROM creators WHERE handle=$1 AND platform=$2 LIMIT 1',
        [cr.handle, cr.platform]
      )
      const id = fetched.data[0]?.id
      if (!id) continue
      creatorIds[`${cr.name}::${cr.platform}`] = id

      for (const catName of cr.categories) {
        const catId = catMap[catName]
        if (catId) {
          await dbQuery(
            'INSERT INTO creator_categories (creator_id, category_id) VALUES ($1, $2) ON CONFLICT (creator_id, category_id) DO NOTHING',
            [id, catId]
          )
        }
      }
    }

    // ── Campaigns (skip if already exist) ──────────────────────────
    const existCamp1 = await dbQuery<{ id: string }>("SELECT id FROM campaigns WHERE name='Observability Platform Launch' LIMIT 1", [])
    if (existCamp1.data.length === 0) {
      await dbQuery(
        `INSERT INTO campaigns (name, client_id, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, personas, created_at, updated_at)
         VALUES ($1,$2,$3,'active','scoring','{"US","EU"}','English','Observability Platform',
           'Promote our cloud-native observability suite to DevOps engineers and SREs. Focus on real-world incident response and monitoring workflows.',
           '{"Senior SRE at mid-size SaaS company","DevOps lead evaluating monitoring tools","Platform engineer building internal developer platform"}',
           now() - interval '5 days', now())`,
        ['Observability Platform Launch', clientId, userId]
      )
    }
    const camp1 = await dbQuery<{ id: string }>("SELECT id FROM campaigns WHERE name='Observability Platform Launch' LIMIT 1", [])
    const campaignId1 = camp1.data[0]?.id

    const existCamp2 = await dbQuery<{ id: string }>("SELECT id FROM campaigns WHERE name='K8s Security Campaign' LIMIT 1", [])
    if (existCamp2.data.length === 0) {
      await dbQuery(
        `INSERT INTO campaigns (name, client_id, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, personas, created_at, updated_at)
         VALUES ($1,$2,$3,'active','discovery','{"US","UK","DE"}','English','Kubernetes Security',
           'Drive awareness of our K8s runtime security product among container-focused engineers and security teams.',
           '{"Security engineer responsible for container workloads","K8s cluster admin at enterprise","DevSecOps practitioner"}',
           now() - interval '2 days', now())`,
        ['K8s Security Campaign', clientId, userId]
      )
    }
    const camp2 = await dbQuery<{ id: string }>("SELECT id FROM campaigns WHERE name='K8s Security Campaign' LIMIT 1", [])
    const campaignId2 = camp2.data[0]?.id

    if (!campaignId1 || !campaignId2) {
      return NextResponse.json({ error: 'Failed to create campaigns' }, { status: 500 })
    }

    // ── Campaign-creator links with varied pipeline stages ─────────
    type CCLink = { creatorKey: string; campaign: string; stage: string; scoringStatus: string; source: string }
    const ccLinks: CCLink[] = [
      // Campaign 1 — Observability (more advanced, has scored creators)
      { creatorKey: 'DevOps & AI Toolkit::youtube', campaign: campaignId1, stage: 'scored', scoringStatus: 'scored', source: 'db_match' },
      { creatorKey: 'Anton Putra::youtube', campaign: campaignId1, stage: 'scored', scoringStatus: 'scored', source: 'db_match' },
      { creatorKey: 'Cindy Sridharan::medium', campaign: campaignId1, stage: 'scored', scoringStatus: 'scored', source: 'db_match' },
      { creatorKey: 'Abhishek Veeramalla::youtube', campaign: campaignId1, stage: 'scored', scoringStatus: 'scored', source: 'llm_lookalike' },
      { creatorKey: 'Techno Tim::youtube', campaign: campaignId1, stage: 'ingested', scoringStatus: 'not_scored', source: 'llm_lookalike' },
      { creatorKey: 'Rawkode Academy::youtube', campaign: campaignId1, stage: 'ingested', scoringStatus: 'not_scored', source: 'db_match' },
      { creatorKey: 'That DevOps Guy::youtube', campaign: campaignId1, stage: 'discovered', scoringStatus: 'not_scored', source: 'llm_lookalike' },
      { creatorKey: 'Gergely Orosz::medium', campaign: campaignId1, stage: 'excluded', scoringStatus: 'not_scored', source: 'llm_lookalike' },
      { creatorKey: 'Pavan Belagatti::medium', campaign: campaignId1, stage: 'scored', scoringStatus: 'scored', source: 'db_match' },

      // Campaign 2 — K8s Security (earlier stage, mostly discovered)
      { creatorKey: 'Liz Rice::medium', campaign: campaignId2, stage: 'scored', scoringStatus: 'scored', source: 'db_match' },
      { creatorKey: 'Bret Fisher::youtube', campaign: campaignId2, stage: 'discovered', scoringStatus: 'not_scored', source: 'db_match' },
      { creatorKey: 'TechWorld with Nana::youtube', campaign: campaignId2, stage: 'discovered', scoringStatus: 'not_scored', source: 'llm_lookalike' },
      { creatorKey: 'William Morgan::medium', campaign: campaignId2, stage: 'discovered', scoringStatus: 'not_scored', source: 'db_match' },
      { creatorKey: 'Ioannis Canellos::medium', campaign: campaignId2, stage: 'discovered', scoringStatus: 'not_scored', source: 'llm_lookalike' },
      { creatorKey: 'NetworkChuck::youtube', campaign: campaignId2, stage: 'excluded', scoringStatus: 'not_scored', source: 'llm_lookalike' },
    ]

    const ccIdMap: Record<string, string> = {} // creatorKey+campaign → cc.id

    for (const link of ccLinks) {
      const creatorId = creatorIds[link.creatorKey]
      if (!creatorId) continue
      const existCC = await dbQuery<{ id: string }>(
        'SELECT id FROM campaign_creators WHERE campaign_id=$1 AND creator_id=$2 LIMIT 1',
        [link.campaign, creatorId]
      )
      if (existCC.data.length === 0) {
        await dbQuery(
          `INSERT INTO campaign_creators (campaign_id, creator_id, added_by_user_id, source, pipeline_stage, scoring_status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6, now() - interval '3 days', now())`,
          [link.campaign, creatorId, userId, link.source, link.stage, link.scoringStatus]
        )
      }
      const ccRow = await dbQuery<{ id: string }>(
        'SELECT id FROM campaign_creators WHERE campaign_id=$1 AND creator_id=$2 LIMIT 1',
        [link.campaign, creatorId]
      )
      if (ccRow.data[0]?.id) {
        ccIdMap[`${link.creatorKey}::${link.campaign}`] = ccRow.data[0].id
      }
    }

    // ── Content items (2-3 per YouTube creator, 1-2 per Medium) ────
    type ContentDef = { creatorKey: string; title: string; url: string; platform: string; contentType: string; wordCount: number; publishedDaysAgo: number; views?: number }
    const contentDefs: ContentDef[] = [
      // DevOps & AI Toolkit (Viktor Farcic)
      { creatorKey: 'DevOps & AI Toolkit::youtube', title: 'Is Prometheus Still the Best Choice for Monitoring?', url: 'https://youtube.com/watch?v=demo-vf1', platform: 'youtube', contentType: 'youtube_video', wordCount: 4200, publishedDaysAgo: 12, views: 45000 },
      { creatorKey: 'DevOps & AI Toolkit::youtube', title: 'GitOps with ArgoCD — The Complete Guide', url: 'https://youtube.com/watch?v=demo-vf2', platform: 'youtube', contentType: 'youtube_video', wordCount: 6100, publishedDaysAgo: 25, views: 82000 },
      { creatorKey: 'DevOps & AI Toolkit::youtube', title: 'OpenTelemetry is Eating the Monitoring World', url: 'https://youtube.com/watch?v=demo-vf3', platform: 'youtube', contentType: 'youtube_video', wordCount: 3800, publishedDaysAgo: 5, views: 31000 },
      // Anton Putra
      { creatorKey: 'Anton Putra::youtube', title: 'Grafana vs Datadog: True Cost Comparison', url: 'https://youtube.com/watch?v=demo-ap1', platform: 'youtube', contentType: 'youtube_video', wordCount: 5500, publishedDaysAgo: 8, views: 67000 },
      { creatorKey: 'Anton Putra::youtube', title: 'Building a Complete Monitoring Stack from Scratch', url: 'https://youtube.com/watch?v=demo-ap2', platform: 'youtube', contentType: 'youtube_video', wordCount: 7200, publishedDaysAgo: 18, views: 54000 },
      // Abhishek Veeramalla
      { creatorKey: 'Abhishek Veeramalla::youtube', title: 'Complete DevOps Monitoring with Prometheus & Grafana', url: 'https://youtube.com/watch?v=demo-av1', platform: 'youtube', contentType: 'youtube_video', wordCount: 6800, publishedDaysAgo: 15, views: 210000 },
      { creatorKey: 'Abhishek Veeramalla::youtube', title: 'Kubernetes Observability Stack — Full Tutorial', url: 'https://youtube.com/watch?v=demo-av2', platform: 'youtube', contentType: 'youtube_video', wordCount: 7500, publishedDaysAgo: 30, views: 185000 },
      // Techno Tim
      { creatorKey: 'Techno Tim::youtube', title: 'Ultimate Homelab Monitoring with Grafana & Prometheus', url: 'https://youtube.com/watch?v=demo-tt1', platform: 'youtube', contentType: 'youtube_video', wordCount: 4100, publishedDaysAgo: 20, views: 180000 },
      // TechWorld with Nana
      { creatorKey: 'TechWorld with Nana::youtube', title: 'Kubernetes Monitoring for Beginners', url: 'https://youtube.com/watch?v=demo-nj1', platform: 'youtube', contentType: 'youtube_video', wordCount: 5800, publishedDaysAgo: 45, views: 320000 },
      // Fireship
      { creatorKey: 'Fireship::youtube', title: 'Observability in 100 Seconds', url: 'https://youtube.com/watch?v=demo-fs1', platform: 'youtube', contentType: 'youtube_video', wordCount: 800, publishedDaysAgo: 60, views: 890000 },
      // Cindy Sridharan
      { creatorKey: 'Cindy Sridharan::medium', title: 'Monitoring in the Age of Cloud Native', url: 'https://medium.com/@copyconstruct/monitoring-cloud-native-demo', platform: 'medium', contentType: 'article', wordCount: 6500, publishedDaysAgo: 30 },
      { creatorKey: 'Cindy Sridharan::medium', title: 'Distributed Tracing — We Are Doing It Wrong', url: 'https://medium.com/@copyconstruct/distributed-tracing-demo', platform: 'medium', contentType: 'article', wordCount: 4800, publishedDaysAgo: 14 },
      // Gergely Orosz
      { creatorKey: 'Gergely Orosz::medium', title: 'How Big Tech Runs Production Monitoring', url: 'https://medium.com/@gergelyorosz/big-tech-monitoring-demo', platform: 'medium', contentType: 'article', wordCount: 8200, publishedDaysAgo: 22 },
      // Liz Rice
      { creatorKey: 'Liz Rice::medium', title: 'eBPF for Security Observability in Kubernetes', url: 'https://medium.com/@lizrice/ebpf-security-k8s-demo', platform: 'medium', contentType: 'article', wordCount: 5100, publishedDaysAgo: 10 },
      { creatorKey: 'Liz Rice::medium', title: 'Runtime Security vs Static Analysis: When to Use Each', url: 'https://medium.com/@lizrice/runtime-vs-static-demo', platform: 'medium', contentType: 'article', wordCount: 3900, publishedDaysAgo: 35 },
      // Pavan Belagatti
      { creatorKey: 'Pavan Belagatti::medium', title: 'AI-Powered DevOps: Observability Meets LLMs', url: 'https://medium.com/@pavanbelagatti/ai-devops-observability-demo', platform: 'medium', contentType: 'article', wordCount: 3200, publishedDaysAgo: 7 },
    ]

    for (const ci of contentDefs) {
      const creatorId = creatorIds[ci.creatorKey]
      if (!creatorId) continue
      const existCI = await dbQuery<{ id: string }>('SELECT id FROM content_items WHERE url=$1 LIMIT 1', [ci.url])
      if (existCI.data.length > 0) continue
      const metaJson = ci.views ? JSON.stringify({ view_count: ci.views }) : '{}'
      await dbQuery(
        `INSERT INTO content_items (creator_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5, now() - interval '${ci.publishedDaysAgo} days', now(),'English','[transcript placeholder]',$6,$7::jsonb,'seed','complete',now(),now())`,
        [creatorId, ci.platform, ci.contentType, ci.title, ci.url, ci.wordCount, metaJson]
      )
    }

    // ── Creator evaluations (for scored campaign_creators) ─────────
    type EvalDef = {
      creatorKey: string; campaignId: string;
      overall: number; technical: number; audience: number; quality: number; performance: number; brandFit: number;
      coverage: string; nmr: boolean; nmrReason?: string;
      strengths: string[]; weaknesses: string[]; rationale: string;
    }
    const evalDefs: EvalDef[] = [
      {
        creatorKey: 'DevOps & AI Toolkit::youtube', campaignId: campaignId1,
        overall: 88, technical: 92, audience: 85, quality: 90, performance: 82, brandFit: 91,
        coverage: 'strong', nmr: false,
        strengths: ['Deep monitoring/observability expertise', 'Regular publishing cadence (2-3x/week)', 'Authentic voice — community trusts recommendations'],
        weaknesses: ['Audience skews senior — may miss mid-level engineers', 'Sometimes overly technical for sponsored content'],
        rationale: 'Viktor is a top-tier DevOps creator with deep, authentic coverage of monitoring tools. His audience directly matches the target persona of senior SREs evaluating observability solutions. Three recent videos on OpenTelemetry and Prometheus demonstrate strong topical alignment.',
      },
      {
        creatorKey: 'Anton Putra::youtube', campaignId: campaignId1,
        overall: 82, technical: 88, audience: 78, quality: 85, performance: 80, brandFit: 79,
        coverage: 'strong', nmr: false,
        strengths: ['Cost-comparison format is ideal for product positioning', 'Growing rapidly — 180K subs', 'Infrastructure-focused audience'],
        weaknesses: ['Smaller audience than competitors', 'Less brand-name recognition'],
        rationale: 'Anton produces high-quality infrastructure comparison content. His Grafana vs Datadog video demonstrates the exact format that would work for an observability product campaign.',
      },
      {
        creatorKey: 'Cindy Sridharan::medium', campaignId: campaignId1,
        overall: 91, technical: 95, audience: 88, quality: 93, performance: 75, brandFit: 94,
        coverage: 'strong', nmr: true, nmrReason: 'Has historically been critical of vendor-sponsored content. Approach with editorial independence offer.',
        strengths: ['Industry-recognized observability authority', 'Content cited in academic + industry contexts', 'Perfect topical match — wrote the book on monitoring'],
        weaknesses: ['Low publishing frequency', 'May decline sponsored work — values editorial independence', 'No video content — written only'],
        rationale: 'Cindy is the gold standard for observability thought leadership. Her work on distributed tracing and monitoring is widely cited. However, she has been vocal about maintaining editorial independence, so any engagement would need a light-touch approach.',
      },
      {
        creatorKey: 'Abhishek Veeramalla::youtube', campaignId: campaignId1,
        overall: 84, technical: 80, audience: 88, quality: 82, performance: 90, brandFit: 80,
        coverage: 'strong', nmr: false,
        strengths: ['Massive engaged audience (595K subs)', '733 videos — extremely high output', 'Full DevOps monitoring tutorials with Prometheus & Grafana'],
        weaknesses: ['Content breadth may dilute observability focus', 'Audience skews beginner-to-intermediate', 'India-based — check geo alignment with campaign targets'],
        rationale: 'Abhishek has a large, fast-growing audience and comprehensive DevOps tutorial content. His Prometheus & Grafana monitoring series directly aligns with the observability campaign. High output cadence and strong engagement make him a solid reach play, though audience seniority skews lower than ideal.',
      },
      {
        creatorKey: 'Pavan Belagatti::medium', campaignId: campaignId1,
        overall: 65, technical: 60, audience: 68, quality: 62, performance: 70, brandFit: 65,
        coverage: 'partial', nmr: true, nmrReason: 'Content quality inconsistent. Some articles read as thinly-veiled product placements. Review recent work before engaging.',
        strengths: ['High publishing frequency', 'DevOps + AI angle is timely', 'Open to sponsorship'],
        weaknesses: ['Content depth below threshold for senior audience', 'History of promotional content may reduce trust', 'Writing quality inconsistent'],
        rationale: 'Pavan publishes frequently on DevOps topics and would likely accept sponsorship, but content quality is uneven. The AI-DevOps angle is interesting but articles lack the depth expected by senior SRE audiences.',
      },
      {
        creatorKey: 'Liz Rice::medium', campaignId: campaignId2,
        overall: 94, technical: 96, audience: 90, quality: 95, performance: 88, brandFit: 97,
        coverage: 'strong', nmr: false,
        strengths: ['eBPF + K8s security pioneer', 'CTO at Isovalent — massive credibility', 'Conference keynote regular — amplification beyond written content'],
        weaknesses: ['Very selective about partnerships', 'May have competing vendor relationships'],
        rationale: 'Liz is the ideal creator for a K8s security campaign. Her eBPF security observability article directly addresses the product space. As Isovalent CTO and a CNCF fixture, her endorsement carries enormous weight in the cloud-native security community.',
      },
    ]

    for (const ev of evalDefs) {
      const ccKey = `${ev.creatorKey}::${ev.campaignId}`
      const ccId = ccIdMap[ccKey]
      if (!ccId) continue
      const existEval = await dbQuery<{ id: string }>('SELECT id FROM creator_evaluations WHERE campaign_creator_id=$1 LIMIT 1', [ccId])
      if (existEval.data.length > 0) continue
      await dbQuery(
        `INSERT INTO creator_evaluations (campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, needs_manual_review_reason,
          overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit,
          strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
         VALUES ($1,'anthropic','claude-sonnet-4-5-20250514', now() - interval '1 day', $2, $3, $4,
          $5,$6,$7,$8,$9,$10,
          $11::jsonb, $12::jsonb, $13, now(), now())`,
        [
          ccId, ev.coverage, ev.nmr, ev.nmrReason || null,
          ev.overall, ev.technical, ev.audience, ev.quality, ev.performance, ev.brandFit,
          JSON.stringify(ev.strengths), JSON.stringify(ev.weaknesses), ev.rationale,
        ]
      )
    }

    // ── Activity log ───────────────────────────────────────────────
    type ActivityDef = { campaignId: string; creatorKey?: string; eventType: string; data: Record<string, unknown>; daysAgo: number; hoursAgo?: number }
    const activityDefs: ActivityDef[] = [
      { campaignId: campaignId1, eventType: 'campaign_created', data: { campaign_name: 'Observability Platform Launch' }, daysAgo: 5 },
      { campaignId: campaignId2, eventType: 'campaign_created', data: { campaign_name: 'K8s Security Campaign' }, daysAgo: 2 },
      { campaignId: campaignId1, eventType: 'discovery_started', data: { source: 'db_match', count: 6 }, daysAgo: 4, hoursAgo: 20 },
      { campaignId: campaignId1, eventType: 'discovery_completed', data: { creators_found: 9, from_db: 5, from_llm: 4 }, daysAgo: 4, hoursAgo: 19 },
      { campaignId: campaignId1, creatorKey: 'DevOps & AI Toolkit::youtube', eventType: 'creator_evaluated', data: { score: 88, coverage: 'strong' }, daysAgo: 1, hoursAgo: 8 },
      { campaignId: campaignId1, creatorKey: 'Anton Putra::youtube', eventType: 'creator_evaluated', data: { score: 82, coverage: 'strong' }, daysAgo: 1, hoursAgo: 7 },
      { campaignId: campaignId1, creatorKey: 'Cindy Sridharan::medium', eventType: 'creator_evaluated', data: { score: 91, coverage: 'strong', needs_manual_review: true }, daysAgo: 1, hoursAgo: 6 },
      { campaignId: campaignId1, creatorKey: 'Abhishek Veeramalla::youtube', eventType: 'creator_evaluated', data: { score: 84, coverage: 'strong' }, daysAgo: 1, hoursAgo: 5 },
      { campaignId: campaignId1, creatorKey: 'Pavan Belagatti::medium', eventType: 'creator_evaluated', data: { score: 65, coverage: 'partial', needs_manual_review: true }, daysAgo: 1, hoursAgo: 4 },
      { campaignId: campaignId1, creatorKey: 'Gergely Orosz::medium', eventType: 'creator_excluded', data: { reason: 'Primary focus is engineering management, not observability tooling' }, daysAgo: 1, hoursAgo: 3 },
      { campaignId: campaignId2, eventType: 'discovery_started', data: { source: 'db_match', count: 4 }, daysAgo: 1, hoursAgo: 2 },
      { campaignId: campaignId2, eventType: 'discovery_completed', data: { creators_found: 5, from_db: 3, from_llm: 2 }, daysAgo: 1, hoursAgo: 1 },
      { campaignId: campaignId2, creatorKey: 'Liz Rice::medium', eventType: 'creator_evaluated', data: { score: 94, coverage: 'strong' }, daysAgo: 0, hoursAgo: 2 },
    ]

    for (const act of activityDefs) {
      const creatorId = act.creatorKey ? creatorIds[act.creatorKey] || null : null
      const interval = act.hoursAgo !== undefined
        ? `${act.daysAgo} days ${act.hoursAgo} hours`
        : `${act.daysAgo} days`
      await dbQuery(
        `INSERT INTO activity_log (campaign_id, creator_id, actor_user_id, event_type, event_data_json, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb, now() - interval '${interval}')`,
        [act.campaignId, creatorId, userId, act.eventType, JSON.stringify(act.data)]
      )
    }

    return NextResponse.json({
      message: 'Demo seeded successfully',
      creators: Object.keys(creatorIds).length,
      campaigns: 2,
      campaign_creators: ccLinks.length,
      content_items: contentDefs.length,
      evaluations: evalDefs.length,
      activity_events: activityDefs.length,
    })
  } catch (e) {
    console.error('[seed-demo]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
