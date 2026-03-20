import { NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ── DELETE: wipe demo data ────────────────────────────────────────

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
    // NOTE: creators and content_items are permanent — never deleted
    return NextResponse.json({ ok: true, deleted: camps.data.length })
  } catch (e) {
    console.error('[demo/setup DELETE]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// ── POST: seed complete demo campaign ─────────────────────────────

export async function POST() {
  try {
    // ── Prerequisites ─────────────────────────────────────────────
    const userRows = await dbQuery<{ id: string }>(`SELECT id FROM ${t('app_users')} ORDER BY created_at LIMIT 1`, [])
    const userId = userRows.data[0]?.id
    if (!userId) return NextResponse.json({ error: 'No app_users found' }, { status: 500 })

    let clientId: string
    const existClient = await dbQuery<{ id: string }>(`SELECT id FROM ${t('clients')} WHERE name='QA.tech' LIMIT 1`, [])
    if (existClient.data[0]?.id) {
      clientId = existClient.data[0].id
    } else {
      const altClient = await dbQuery<{ id: string }>(`SELECT id FROM ${t('clients')} LIMIT 1`, [])
      clientId = altClient.data[0]?.id
      if (!clientId) return NextResponse.json({ error: 'No clients found' }, { status: 500 })
    }

    // ── Idempotency: only reuse if campaign has scored creators ──
    const existCamp = await dbQuery<{ id: string }>(`SELECT id FROM ${t('campaigns')} WHERE name LIKE '[DEMO]%' LIMIT 1`, [])
    if (existCamp.data[0]?.id) {
      const ccCount = await dbQuery<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${t('campaign_creators')} cc
         JOIN ${t('creator_evaluations')} e ON e.campaign_creator_id = cc.id
         WHERE cc.campaign_id = $1`, [existCamp.data[0].id])
      if (parseInt(ccCount.data[0]?.count || '0') > 0) {
        return NextResponse.json({ campaign_id: existCamp.data[0].id })
      }
      // Incomplete seed — delete and re-create
      console.log('[demo/setup] Found incomplete demo campaign, deleting and re-seeding...')
      await DELETE()
    }

    // ── Campaign ──────────────────────────────────────────────────
    // Re-check after potential DELETE (guard against concurrent calls)
    const recheck = await dbQuery<{ id: string }>(`SELECT id FROM ${t('campaigns')} WHERE name LIKE '[DEMO]%' LIMIT 1`, [])
    if (recheck.data[0]?.id) {
      // Another concurrent call already created it — wait briefly and return it
      const ccCount2 = await dbQuery<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${t('campaign_creators')} WHERE campaign_id = $1`, [recheck.data[0].id])
      if (parseInt(ccCount2.data[0]?.count || '0') > 0) {
        return NextResponse.json({ campaign_id: recheck.data[0].id })
      }
    }

    console.log('[demo/setup] Creating campaign...')
    const campaignId = uuidv4()
    await dbQuery(
      `INSERT INTO ${t('campaigns')} (id, name, client_id, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, personas, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', 'review', '{"US","EU","UK"}', 'English', 'AI-Powered Testing',
         'Drive adoption of QA.tech among senior developers, CTOs, and engineering leads who are building modern web applications. QA.tech uses AI to generate and maintain end-to-end tests automatically — no manual test scripting required. Position QA.tech as the breakthrough solution for teams drowning in flaky tests, slow CI pipelines, and inadequate test coverage. Key differentiators: AI-generated tests from natural language, self-healing selectors, visual regression detection, and integration with GitHub Actions, Vercel, and major CI/CD platforms.',
         '{"Senior full-stack developer frustrated with flaky E2E tests","Engineering manager looking to improve test coverage without hiring QA","CTO evaluating AI developer tools for engineering productivity"}',
         now() - interval '3 days', now())`,
      [campaignId, '[DEMO] QA.tech — AI Testing for Modern Teams', clientId, userId]
    )

    console.log('[demo/setup] Campaign created:', campaignId)

    // ── Completed pipeline job ────────────────────────────────────
    const jobId = uuidv4()
    await dbQuery(
      `INSERT INTO ${t('jobs')} (id, type, status, campaign_id, created_by_user_id, started_at, finished_at, created_at, updated_at)
       VALUES ($1, 'full_pipeline', 'completed', $2, $3, now() - interval '2 hours', now() - interval '90 minutes', now() - interval '2 hours', now())`,
      [jobId, campaignId, userId]
    )

    // ── Topics ────────────────────────────────────────────────────
    const topics = ['AI-powered software testing', 'End-to-end test automation', 'CI/CD pipeline optimization', 'Visual regression testing', 'Developer productivity tools']
    for (let i = 0; i < topics.length; i++) {
      await dbQuery(`INSERT INTO ${t('campaign_topics')} (campaign_id, topic, source, confidence, order_index, approved, created_at) VALUES ($1,$2,'ai',$3,$4,true,now())`,
        [campaignId, topics[i], 0.95 - i * 0.03, i])
    }

    // ── Search Terms (15) ─────────────────────────────────────────
    const terms: [string, string, string][] = [
      ['AI end-to-end testing tools 2024', 'product_category', 'Directly targets engineers searching for AI testing solutions'],
      ['playwright vs cypress AI testing', 'competitor', 'Captures engineers comparing testing frameworks — QA.tech automates what these require manually'],
      ['automated E2E test generation', 'product_category', 'High-intent searchers looking for exactly what QA.tech offers'],
      ['flaky test fix strategies', 'problem_solution', 'Targets the #1 pain point QA.tech solves — self-healing selectors'],
      ['visual regression testing tools', 'product_category', 'Key QA.tech feature — captures engineers evaluating visual testing'],
      ['GitHub Actions E2E testing setup', 'integration', 'Targets developers setting up CI testing — QA.tech integrates natively'],
      ['reduce CI pipeline time testing', 'problem_solution', 'Pain point: slow pipelines — QA.tech parallel execution angle'],
      ['no-code test automation platform', 'product_category', 'Natural language test generation — no scripting required'],
      ['AI developer tools productivity', 'product_category', 'Broader AI dev tools audience with testing interest'],
      ['test coverage without QA team', 'problem_solution', 'Matches teams without dedicated QA — core QA.tech persona'],
      ['Vercel deployment testing automation', 'integration', 'Vercel integration is a key QA.tech differentiator'],
      ['selenium alternative modern testing', 'competitor', 'Engineers looking to move beyond legacy test frameworks'],
      ['self-healing test selectors', 'implementation', 'Specific QA.tech feature — highly qualified searches'],
      ['shift left testing DevOps', 'tutorial_format', 'DevOps testing best practices audience'],
      ['AI code review and testing tools', 'product_category', 'Broader AI dev tools with testing crossover'],
    ]
    for (let i = 0; i < terms.length; i++) {
      await dbQuery(`INSERT INTO ${t('campaign_search_terms')} (campaign_id, term, category_tag, why_it_helps, order_index, approved, approved_by_user_id, approved_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,true,$6,now(),now(),now())`,
        [campaignId, terms[i][0], terms[i][1], terms[i][2], i, userId])
    }

    console.log('[demo/setup] Terms + topics seeded')

    // ── Creators ──────────────────────────────────────────────────
    const CREATORS = [
      { name: 'Fireship', handle: 'fireship', subs: 4120000 },
      { name: 'Theo - t3.gg', handle: 't3dotgg', subs: 890000 },
      { name: 'ThePrimeagen', handle: 'theprimeagen', subs: 1200000 },
      { name: 'Traversy Media', handle: 'traversymedia', subs: 2260000 },
      { name: 'Jack Herrington', handle: 'jherr', subs: 365000 },
      { name: 'James Q Quick', handle: 'jamesqquick', subs: 218000 },
      { name: 'Dave Farley', handle: 'continuousdelivery', subs: 195000 },
      { name: 'Continuous Delivery', handle: 'inthecodeapp', subs: 42000 },
    ]

    const creatorIds: Record<string, string> = {}
    for (const cr of CREATORS) {
      const existing = await dbQuery<{ id: string }>(`SELECT id FROM ${t('creators')} WHERE handle=$1 AND platform='youtube' LIMIT 1`, [cr.handle])
      if (existing.data.length === 0) {
        await dbQuery(
          `INSERT INTO ${t('creators')} (name, display_name, platform, handle, url, subscriber_count, content_language, relationship_status, discovered_via, created_at, updated_at)
           VALUES ($1,$1,'youtube',$2,$3,$4,'English','cold','demo',now(),now())`,
          [cr.name, cr.handle, `https://youtube.com/@${cr.handle}`, cr.subs])
      }
      const row = await dbQuery<{ id: string }>(`SELECT id FROM ${t('creators')} WHERE handle=$1 AND platform='youtube' LIMIT 1`, [cr.handle])
      if (row.data[0]?.id) creatorIds[cr.handle] = row.data[0].id
    }

    console.log('[demo/setup] Creators upserted:', Object.keys(creatorIds).length)

    // ── Content Items ─────────────────────────────────────────────
    const CONTENT: { handle: string; title: string; url: string; words: number; daysAgo: number }[] = [
      { handle: 'fireship', title: 'AI is Killing the Testing Industry', url: 'https://youtube.com/watch?v=demo-fs1', words: 1200, daysAgo: 5 },
      { handle: 'fireship', title: 'E2E Testing in 100 Seconds', url: 'https://youtube.com/watch?v=demo-fs2', words: 800, daysAgo: 30 },
      { handle: 't3dotgg', title: 'I Replaced My Entire Test Suite with AI', url: 'https://youtube.com/watch?v=demo-t31', words: 4800, daysAgo: 8 },
      { handle: 't3dotgg', title: 'The Testing Problem Nobody Talks About', url: 'https://youtube.com/watch?v=demo-t32', words: 5200, daysAgo: 22 },
      { handle: 'theprimeagen', title: 'AI Testing Tools: Overhyped or Underrated?', url: 'https://youtube.com/watch?v=demo-tp1', words: 6500, daysAgo: 10 },
      { handle: 'theprimeagen', title: 'Why Your E2E Tests Are Garbage', url: 'https://youtube.com/watch?v=demo-tp2', words: 5800, daysAgo: 25 },
      { handle: 'traversymedia', title: 'Automated Testing Crash Course 2024', url: 'https://youtube.com/watch?v=demo-tm1', words: 8200, daysAgo: 12 },
      { handle: 'traversymedia', title: 'AI Developer Tools That Actually Work', url: 'https://youtube.com/watch?v=demo-tm2', words: 6100, daysAgo: 35 },
      { handle: 'jherr', title: 'Testing React Apps with AI — Is It Ready?', url: 'https://youtube.com/watch?v=demo-jh1', words: 5500, daysAgo: 7 },
      { handle: 'jherr', title: 'The Future of Frontend Testing', url: 'https://youtube.com/watch?v=demo-jh2', words: 4800, daysAgo: 18 },
      { handle: 'jamesqquick', title: 'I Tested AI Testing Tools So You Don\'t Have To', url: 'https://youtube.com/watch?v=demo-jq1', words: 5000, daysAgo: 9 },
      { handle: 'jamesqquick', title: 'Stop Writing Tests Manually', url: 'https://youtube.com/watch?v=demo-jq2', words: 4200, daysAgo: 28 },
      { handle: 'continuousdelivery', title: 'The Science of Effective Testing', url: 'https://youtube.com/watch?v=demo-df1', words: 7200, daysAgo: 6 },
      { handle: 'continuousdelivery', title: 'AI in Software Testing: What Actually Works', url: 'https://youtube.com/watch?v=demo-df2', words: 6800, daysAgo: 15 },
      { handle: 'inthecodeapp', title: 'E2E Testing Without the Pain', url: 'https://youtube.com/watch?v=demo-ic1', words: 4600, daysAgo: 11 },
      { handle: 'inthecodeapp', title: 'Modern Testing Stack for Web Apps', url: 'https://youtube.com/watch?v=demo-ic2', words: 3800, daysAgo: 32 },
    ]

    const contentIds: Record<string, string> = {}
    for (const ci of CONTENT) {
      const creatorId = creatorIds[ci.handle]
      if (!creatorId) continue
      const existCI = await dbQuery<{ id: string }>(`SELECT id FROM ${t('content_items')} WHERE url=$1 LIMIT 1`, [ci.url])
      if (existCI.data.length === 0) {
        try {
          await dbQuery(
            `INSERT INTO ${t('content_items')} (creator_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, ingestion_method, ingestion_status, created_at, updated_at)
             VALUES ($1,'youtube','youtube_video',$2,$3, now() - interval '${ci.daysAgo} days', now(),'English','[demo transcript]',$4,'demo','complete',now(),now())`,
            [creatorId, ci.title, ci.url, ci.words])
        } catch { /* duplicate from race — safe to ignore */ }
      }
      const row = await dbQuery<{ id: string }>(`SELECT id FROM ${t('content_items')} WHERE url=$1 LIMIT 1`, [ci.url])
      if (row.data[0]?.id) contentIds[ci.url] = row.data[0].id
    }

    console.log('[demo/setup] Content items seeded:', Object.keys(contentIds).length)

    // ── Campaign Creators + Evaluations + Evidence ────────────────
    // Each creator: cc link → evaluation → evidence snippets → content angles

    type CreatorData = {
      handle: string
      overall: number; tech: number; aud: number; qual: number; perf: number; brand: number
      cov: string; nmr: boolean; nmrReason?: string
      strengths: string[]; weaknesses: string[]; rationale: string
      snippets: { contentUrl: string; dim: string; quote: string; why: string; ts?: number }[]
      angles: { title: string; format: string; persona: string; points: string[] }[]
    }

    const DATA: CreatorData[] = [
      {
        handle: 'fireship', overall: 92, tech: 88, aud: 95, qual: 94, perf: 96, brand: 88, cov: 'strong', nmr: false,
        strengths: [
          '4.1M subscribers — massive developer reach across all seniority levels',
          'Short-form format (5-12 min) drives extremely high completion rates',
          'Trusted voice for developer tool recommendations — sponsorships feel authentic',
        ],
        weaknesses: [
          'Short format limits deep product walkthroughs',
          'Audience breadth means lower % of target persona vs niche channels',
        ],
        rationale: 'Jeff Delaney\'s Fireship is the highest-reach developer channel available. His "AI is Killing the Testing Industry" video demonstrates perfect topical alignment and his audience of 4.1M developers includes a massive segment of our target personas. His authentic, fast-paced style makes sponsored integrations feel like genuine recommendations.',
        snippets: [
          { contentUrl: 'https://youtube.com/watch?v=demo-fs1', dim: 'technical_relevance', ts: 85,
            quote: 'The days of writing manual E2E test scripts are numbered. AI can now observe your app, understand the user flows, and generate tests that actually catch real bugs.',
            why: 'Directly validates QA.tech\'s core value proposition to a massive audience' },
          { contentUrl: 'https://youtube.com/watch?v=demo-fs1', dim: 'brand_fit', ts: 210,
            quote: 'The real game-changer isn\'t AI writing tests — it\'s AI maintaining them. Self-healing selectors mean your CI pipeline doesn\'t break every time someone changes a button class.',
            why: 'Highlights QA.tech\'s self-healing feature as the key differentiator, framed in a pain point developers viscerally understand' },
          { contentUrl: 'https://youtube.com/watch?v=demo-fs2', dim: 'audience_alignment',
            quote: 'Every developer knows they should test more. The problem isn\'t motivation — it\'s that writing E2E tests is soul-crushing work.',
            why: 'Frames the exact emotional pain point that drives QA.tech adoption' },
        ],
        angles: [
          { title: 'QA.tech in 100 Seconds', format: 'short_explainer', persona: 'Senior full-stack developer', points: ['AI test generation demo from natural language', 'Self-healing selector showcase', 'GitHub Actions integration in 30 seconds'] },
          { title: 'I Replaced Playwright with AI Testing', format: 'challenge_video', persona: 'Engineering manager', points: ['Side-by-side: manual vs AI-generated tests', 'Time comparison: 3 hours → 5 minutes', 'Coverage comparison on real app'] },
        ],
      },
      {
        handle: 't3dotgg', overall: 90, tech: 92, aud: 90, qual: 88, perf: 88, brand: 92, cov: 'strong', nmr: false,
        strengths: [
          'Deep technical credibility — builds production apps and reviews tools honestly',
          '890K subscribers of highly engaged senior developers and tech leads',
          'Already created content about AI replacing test suites — perfect topical fit',
        ],
        weaknesses: [
          'Known for strong opinions — will not promote something he doesn\'t believe in',
          'TypeScript/Next.js focused — may not reach backend-heavy audiences',
        ],
        rationale: 'Theo\'s "I Replaced My Entire Test Suite with AI" is the exact content we need. His audience of senior TypeScript/React developers maps perfectly to QA.tech\'s ideal customer. His honest, opinionated style means an endorsement from him carries enormous weight — but he\'ll need to genuinely like the product.',
        snippets: [
          { contentUrl: 'https://youtube.com/watch?v=demo-t31', dim: 'technical_relevance', ts: 340,
            quote: 'I threw out 400 Playwright tests and replaced them with AI-generated ones. The crazy part? The AI tests caught two bugs our manual tests missed for months.',
            why: 'Real-world validation of AI testing superiority with specific, credible numbers' },
          { contentUrl: 'https://youtube.com/watch?v=demo-t31', dim: 'content_quality', ts: 720,
            quote: 'The before and after is ridiculous. We went from a 45-minute CI pipeline to 12 minutes, and our test coverage actually went UP.',
            why: 'Quantified results that directly map to QA.tech\'s value proposition — faster CI + better coverage' },
          { contentUrl: 'https://youtube.com/watch?v=demo-t32', dim: 'audience_alignment', ts: 180,
            quote: 'Here\'s what nobody talks about: the maintenance cost. You write 200 E2E tests, ship a redesign, and suddenly half of them are broken. That\'s not a testing problem — it\'s a tooling problem.',
            why: 'Articulates the self-healing selectors value prop as a tooling insight, not a sales pitch' },
        ],
        angles: [
          { title: 'From 400 Flaky Tests to Zero Maintenance', format: 'case_study', persona: 'Senior full-stack developer', points: ['Live migration from Playwright to AI-generated tests', 'Real metrics: CI time, coverage, flake rate', 'Developer experience improvement'] },
          { title: 'The AI Testing Stack I Actually Use in Production', format: 'recommendation', persona: 'CTO evaluating AI developer tools', points: ['Integration with T3 stack (Next.js, tRPC)', 'Honest comparison vs Playwright/Cypress', 'When AI testing works vs when it doesn\'t'] },
        ],
      },
      {
        handle: 'theprimeagen', overall: 85, tech: 82, aud: 88, qual: 86, perf: 90, brand: 78, cov: 'strong', nmr: false,
        strengths: [
          '1.2M subscribers of opinionated, senior engineers who influence tool adoption',
          'High-energy presentation style drives massive engagement and shareability',
          'Known for honest takes — an endorsement is extremely valuable precisely because he\'s critical',
        ],
        weaknesses: [
          'Very opinionated — could go negative if product doesn\'t impress him',
          'Backend/systems focus — E2E web testing is adjacent, not core to his content',
          'Entertainment-first format may not suit detailed product walkthrough',
        ],
        rationale: 'Prime\'s "AI Testing Tools: Overhyped or Underrated?" shows genuine curiosity about the space. His massive senior developer audience overlaps strongly with engineering leads evaluating QA tooling. An endorsement from Prime would drive significant attention, but the product must genuinely impress him — he will not pull punches.',
        snippets: [
          { contentUrl: 'https://youtube.com/watch?v=demo-tp1', dim: 'audience_alignment', ts: 445,
            quote: 'Look, I\'m a testing skeptic. Most testing tools just create more work. But if an AI can actually watch me use the app and generate tests that catch real regressions? That\'s a different conversation.',
            why: 'Skeptic-to-believer narrative from a trusted voice — the most powerful form of endorsement' },
          { contentUrl: 'https://youtube.com/watch?v=demo-tp2', dim: 'technical_relevance', ts: 280,
            quote: 'Your E2E tests are garbage because you\'re testing implementation details, not user behavior. AI doesn\'t make that mistake because it doesn\'t know your code — it only knows what the user sees.',
            why: 'Technical insight that positions AI testing as architecturally superior, not just more convenient' },
        ],
        angles: [
          { title: 'Prime Tries AI Testing (Live Reaction)', format: 'reaction_video', persona: 'Senior full-stack developer', points: ['Live first-time reaction to AI test generation', 'Honest critique of generated tests vs hand-written', 'Would he actually use this in production?'] },
        ],
      },
      {
        handle: 'traversymedia', overall: 84, tech: 78, aud: 86, qual: 82, perf: 92, brand: 84, cov: 'strong', nmr: false,
        strengths: [
          '2.26M subscribers — second-largest reach in our candidate pool',
          'Tutorial-first format is perfect for product walkthroughs and integrations',
          'Audience of mid-level developers actively learning new tools — high adoption intent',
        ],
        weaknesses: [
          'Audience skews mid-level — less influence on engineering leadership decisions',
          'Crash course format may oversimplify QA.tech\'s differentiators',
        ],
        rationale: 'Brad Traversy\'s "Automated Testing Crash Course 2024" and AI developer tools content show strong topical alignment. His tutorial format is ideal for showing QA.tech\'s workflow from signup to first AI-generated test. The 2.26M subscriber base of actively-learning developers represents a huge adoption funnel.',
        snippets: [
          { contentUrl: 'https://youtube.com/watch?v=demo-tm1', dim: 'content_quality', ts: 560,
            quote: 'Testing is the one area where every developer knows they should do more but nobody wants to. If a tool can generate 80% of your tests automatically, that changes the entire equation.',
            why: 'Frames AI testing as the solution to a universal developer guilt — powerful motivator' },
          { contentUrl: 'https://youtube.com/watch?v=demo-tm2', dim: 'brand_fit', ts: 320,
            quote: 'I\'ve tried a lot of "AI developer tools" this year. Most are glorified autocomplete. The ones that actually work are solving specific, painful problems — not trying to replace you.',
            why: 'Sets up QA.tech\'s positioning as a specific pain-point solver, not generic AI hype' },
        ],
        angles: [
          { title: 'QA.tech Crash Course — AI Testing in 30 Minutes', format: 'tutorial', persona: 'Senior full-stack developer', points: ['Setup to first test in 5 minutes', 'Natural language test authoring demo', 'CI/CD integration walkthrough'] },
        ],
      },
      {
        handle: 'jherr', overall: 89, tech: 94, aud: 86, qual: 90, perf: 82, brand: 90, cov: 'strong', nmr: false,
        strengths: [
          'Deep React/frontend expertise — QA.tech\'s primary target framework ecosystem',
          'Technical depth earns trust from senior engineers and architects',
          'Already exploring AI testing for React — natural content fit',
        ],
        weaknesses: [
          'Smaller audience (365K) limits raw reach',
          'Highly technical style may not appeal to non-technical decision makers',
        ],
        rationale: 'Jack Herrington\'s "Testing React Apps with AI — Is It Ready?" is a direct content match. His audience of senior React developers and architects is the highest-quality segment for QA.tech. His deep technical approach means a positive review carries enormous credibility within the React ecosystem.',
        snippets: [
          { contentUrl: 'https://youtube.com/watch?v=demo-jh1', dim: 'technical_relevance', ts: 420,
            quote: 'I pointed the AI at my React app and said "test the checkout flow." It generated 12 test cases including edge cases I hadn\'t thought of — invalid coupon codes, expired sessions, race conditions on double-submit.',
            why: 'Concrete, specific example of AI test generation quality that will impress technical evaluators' },
          { contentUrl: 'https://youtube.com/watch?v=demo-jh2', dim: 'content_quality', ts: 190,
            quote: 'The future of frontend testing isn\'t writing better tests. It\'s having a system that understands your app well enough to test it for you — and smart enough to fix itself when you ship changes.',
            why: 'Visionary framing that positions QA.tech as the future, not just another tool' },
        ],
        angles: [
          { title: 'AI Testing Deep Dive: Can It Handle a Real React App?', format: 'deep_dive', persona: 'Senior full-stack developer', points: ['Complex React app with auth, forms, real-time features', 'AI-generated vs hand-written test comparison', 'Coverage analysis and blind spot identification'] },
          { title: 'QA.tech + Next.js: Zero to Full Coverage', format: 'tutorial', persona: 'Engineering manager', points: ['Next.js App Router testing challenges', 'AI handling SSR, dynamic routes, API routes', 'Integration with Vercel deployment pipeline'] },
        ],
      },
      {
        handle: 'jamesqquick', overall: 82, tech: 80, aud: 84, qual: 82, perf: 80, brand: 85, cov: 'strong', nmr: false,
        strengths: [
          'Authentic "I tried it so you don\'t have to" format drives high trust',
          'Already reviewed AI testing tools — established content niche',
          'Strong community engagement — comments drive secondary conversations',
        ],
        weaknesses: [
          'Smaller audience (218K) means limited reach per video',
          'Generalist web dev focus — not exclusively testing-focused',
        ],
        rationale: 'James\'s "I Tested AI Testing Tools So You Don\'t Have To" is the exact content format QA.tech needs. His honest review style and engaged community make him ideal for a product that wants to build trust through transparency rather than hype.',
        snippets: [
          { contentUrl: 'https://youtube.com/watch?v=demo-jq1', dim: 'brand_fit', ts: 380,
            quote: 'Most AI testing tools I\'ve tried are basically demo-ware — they work great on a todo app but fall apart on anything real. The bar for "actually useful" is higher than people think.',
            why: 'Sets a high bar that QA.tech can clear — implicit endorsement if QA.tech passes his test' },
          { contentUrl: 'https://youtube.com/watch?v=demo-jq2', dim: 'audience_alignment', ts: 145,
            quote: 'I spent 3 days last month updating Cypress tests that broke because we changed the nav. Three. Days. There has to be a better way.',
            why: 'Visceral pain point story that every developer relates to — perfect setup for QA.tech\'s self-healing pitch' },
        ],
        angles: [
          { title: 'Honest Review: Can AI Replace Your Test Suite?', format: 'review', persona: 'Senior full-stack developer', points: ['Real app test generation vs manual baseline', 'Maintenance time comparison over 2 weeks', 'Honest pros and cons breakdown'] },
        ],
      },
      {
        handle: 'continuousdelivery', overall: 88, tech: 95, aud: 82, qual: 92, perf: 75, brand: 90, cov: 'strong', nmr: false,
        strengths: [
          'Dave Farley is THE authority on software testing and continuous delivery',
          'His endorsement carries weight with CTOs and VP Engineering',
          'Science-based approach to testing aligns with QA.tech\'s data-driven positioning',
        ],
        weaknesses: [
          'Smaller audience (195K) and more academic tone',
          'Audience skews senior/principal — less direct user adoption influence',
          'Longer format (20-40 min) has lower casual viewership',
        ],
        rationale: 'Dave Farley literally wrote the book on Continuous Delivery. His "AI in Software Testing: What Actually Works" shows he\'s actively evaluating AI testing tools with scientific rigor. An endorsement from Dave would give QA.tech unmatched credibility with engineering leadership — the decision-makers who approve tool budgets.',
        snippets: [
          { contentUrl: 'https://youtube.com/watch?v=demo-df1', dim: 'technical_relevance', ts: 680,
            quote: 'Effective testing is about fast feedback loops and high confidence. If AI can generate tests that provide both — genuine fast feedback on real user behavior — then it\'s not replacing testers, it\'s amplifying engineering teams.',
            why: 'Frames AI testing in rigorous engineering terms that CTOs and VPs will cite in procurement decisions' },
          { contentUrl: 'https://youtube.com/watch?v=demo-df2', dim: 'content_quality', ts: 340,
            quote: 'I was skeptical until I saw the self-healing capability. When your tests adapt to UI changes automatically, you eliminate the single biggest source of test maintenance cost. The ROI math changes completely.',
            why: 'Skeptic-to-convert narrative from the industry\'s most respected testing authority' },
          { contentUrl: 'https://youtube.com/watch?v=demo-df2', dim: 'brand_fit', ts: 890,
            quote: 'The teams getting value from AI testing are the ones who treat it as an engineering discipline, not a magic wand. The tool generates tests — you still need to understand what good testing looks like.',
            why: 'Nuanced take that positions QA.tech as a serious engineering tool, not AI hype' },
        ],
        angles: [
          { title: 'The Science Behind AI Test Generation', format: 'deep_dive', persona: 'CTO evaluating AI developer tools', points: ['How AI understands user flows vs implementation details', 'Statistical confidence in AI-generated test coverage', 'When AI testing improves engineering outcomes and when it doesn\'t'] },
        ],
      },
      {
        handle: 'inthecodeapp', overall: 76, tech: 80, aud: 72, qual: 78, perf: 68, brand: 80, cov: 'partial', nmr: true,
        nmrReason: 'Smaller channel (42K subs) limits reach. Strong E2E testing content but verify engagement rates and audience geography before committing budget.',
        strengths: [
          'E2E testing is core content focus — not a side topic',
          'Practical, hands-on style with real project examples',
          'Growing audience in the testing tools niche',
        ],
        weaknesses: [
          'Small audience (42K) — limited raw reach for campaign budget',
          'Less brand recognition than larger creators',
          'Inconsistent publishing schedule',
        ],
        rationale: 'InTheCodeApp\'s dedicated focus on E2E testing makes them a strong niche fit, but the 42K subscriber base limits campaign ROI. Consider for a community-focused campaign or as a secondary placement alongside a higher-reach creator.',
        snippets: [
          { contentUrl: 'https://youtube.com/watch?v=demo-ic1', dim: 'technical_relevance', ts: 240,
            quote: 'E2E testing doesn\'t have to be painful. The trick is choosing tools that understand your app structure instead of fighting against it.',
            why: 'Positions the right mindset for QA.tech adoption — tooling over process' },
          { contentUrl: 'https://youtube.com/watch?v=demo-ic2', dim: 'audience_alignment', ts: 180,
            quote: 'If you\'re building a modern web app in 2024 and you\'re still writing Selenium tests, we need to talk.',
            why: 'Directly addresses migration from legacy tools — a key QA.tech onboarding path' },
        ],
        angles: [
          { title: 'Migrating from Selenium to AI-Powered Testing', format: 'tutorial', persona: 'Senior full-stack developer', points: ['Step-by-step migration from legacy test suite', 'Handling edge cases in migration', 'Before/after maintenance cost comparison'] },
        ],
      },
    ]

    for (const d of DATA) {
      const creatorId = creatorIds[d.handle]
      if (!creatorId) continue

      // Campaign creator link
      const existCC = await dbQuery<{ id: string }>(`SELECT id FROM ${t('campaign_creators')} WHERE campaign_id=$1 AND creator_id=$2 LIMIT 1`, [campaignId, creatorId])
      if (existCC.data.length === 0) {
        await dbQuery(
          `INSERT INTO ${t('campaign_creators')} (campaign_id, creator_id, added_by_user_id, source, pipeline_stage, scoring_status, created_at, updated_at)
           VALUES ($1,$2,$3,'db_match','scored','scored', now() - interval '2 hours', now())`,
          [campaignId, creatorId, userId])
      }
      const ccRow = await dbQuery<{ id: string }>(`SELECT id FROM ${t('campaign_creators')} WHERE campaign_id=$1 AND creator_id=$2 LIMIT 1`, [campaignId, creatorId])
      const ccId = ccRow.data[0]?.id
      if (!ccId) continue

      // Evaluation
      const existEval = await dbQuery<{ id: string }>(`SELECT id FROM ${t('creator_evaluations')} WHERE campaign_creator_id=$1 LIMIT 1`, [ccId])
      if (existEval.data.length === 0) {
        await dbQuery(
          `INSERT INTO ${t('creator_evaluations')} (campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, needs_manual_review_reason,
            overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit,
            strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
           VALUES ($1,'anthropic','claude-sonnet-4-5-20250514', now() - interval '90 minutes', $2, $3, $4,
            $5,$6,$7,$8,$9,$10, $11::jsonb, $12::jsonb, $13, now(), now())`,
          [ccId, d.cov, d.nmr, d.nmrReason || null, d.overall, d.tech, d.aud, d.qual, d.perf, d.brand,
           JSON.stringify(d.strengths), JSON.stringify(d.weaknesses), d.rationale])
      }
      const evalRow = await dbQuery<{ id: string }>(`SELECT id FROM ${t('creator_evaluations')} WHERE campaign_creator_id=$1 LIMIT 1`, [ccId])
      const evalId = evalRow.data[0]?.id
      if (!evalId) continue

      // Evidence snippets
      for (const sn of d.snippets) {
        const ciId = contentIds[sn.contentUrl]
        if (!ciId) continue
        await dbQuery(
          `INSERT INTO ${t('evidence_snippets')} (evaluation_id, content_item_id, quote, dimension, why_it_matters, timestamp_start_seconds, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
          [evalId, ciId, sn.quote, sn.dim, sn.why, sn.ts || null])
      }

      // Content angles
      for (const angle of d.angles) {
        await dbQuery(
          `INSERT INTO ${t('content_angles')} (evaluation_id, title, format, persona, key_points_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())`,
          [evalId, angle.title, angle.format, angle.persona, JSON.stringify(angle.points)])
      }
    }

    console.log('[demo/setup] Complete! Campaign:', campaignId)
    return NextResponse.json({ campaign_id: campaignId })
  } catch (e) {
    console.error('[demo/setup] ERROR:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
