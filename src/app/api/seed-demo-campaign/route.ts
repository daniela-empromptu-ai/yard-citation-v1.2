import { NextResponse } from 'next/server'
import { dbQuery, t } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/seed-demo-campaign
 * Seeds the Pixelcraft Studio demo campaign with 10 creators, 50 content items,
 * evaluations, evidence snippets, and content angles.
 * Idempotent: returns early if campaign already exists.
 */
export async function GET() {
  try {
    // ── Idempotency guard ─────────────────────────────────────────
    const existingCampaign = await dbQuery<{ id: string }>(
      `SELECT id FROM ${t('campaigns')} WHERE name = 'Pixelcraft — Design Systems & DX' LIMIT 1`, []
    )
    if (existingCampaign.data.length > 0) {
      return NextResponse.json({ message: 'Already seeded', campaign_id: existingCampaign.data[0].id })
    }

    // ── Reference data ────────────────────────────────────────────
    const userRows = await dbQuery<{ id: string }>(
      `SELECT id FROM ${t('app_users')} ORDER BY created_at LIMIT 1`, []
    )
    const userId = userRows.data[0]?.id
    if (!userId) return NextResponse.json({ error: 'No app_users found' }, { status: 500 })

    // ── Client (upsert) ───────────────────────────────────────────
    const existingClient = await dbQuery<{ id: string }>(
      `SELECT id FROM ${t('clients')} WHERE name = 'Pixelcraft Studio' LIMIT 1`, []
    )
    if (existingClient.data.length === 0) {
      await dbQuery(
        `INSERT INTO ${t('clients')} (name, created_at, updated_at) VALUES ('Pixelcraft Studio', now(), now())`, []
      )
    }
    const clientRow = await dbQuery<{ id: string }>(
      `SELECT id FROM ${t('clients')} WHERE name = 'Pixelcraft Studio' LIMIT 1`, []
    )
    const clientId = clientRow.data[0]?.id
    if (!clientId) return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })

    // ── Campaign ──────────────────────────────────────────────────
    await dbQuery(
      `INSERT INTO ${t('campaigns')} (name, client_id, owner_user_id, status, stage, geo_targets, language, product_category, creative_brief, personas, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', 'review', '{"US","EU","UK"}', 'English', 'Design System Tooling',
         $4,
         '{"Design engineer building component libraries at a SaaS company","Frontend lead standardizing a design system across multiple products","Product designer who codes and wants seamless Figma-to-React workflows"}',
         now() - interval '7 days', now())`,
      [
        'Pixelcraft — Design Systems & DX',
        clientId,
        userId,
        'Pixelcraft Studio builds design-to-code tooling for modern product teams. Our flagship product turns Figma designs into production-ready React components with design tokens, accessibility baked in, and full Storybook integration. Position Pixelcraft as the essential bridge between design and engineering — eliminating the handoff gap that slows every product team. Target frontend developers building component libraries, design engineers who live in both Figma and VS Code, and product leads frustrated by the design-to-production bottleneck. Key differentiators: Figma plugin with one-click React export, automatic design token extraction, WCAG 2.1 AA compliance checking, and native Storybook story generation.',
      ]
    )
    const campRow = await dbQuery<{ id: string }>(
      `SELECT id FROM ${t('campaigns')} WHERE name = 'Pixelcraft — Design Systems & DX' LIMIT 1`, []
    )
    const campaignId = campRow.data[0]?.id
    if (!campaignId) return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })

    // ── Completed pipeline job ────────────────────────────────────
    await dbQuery(
      `INSERT INTO ${t('jobs')} (campaign_id, type, status, started_at, finished_at, created_at, updated_at)
       VALUES ($1, 'full_pipeline', 'completed', now() - interval '2 hours', now() - interval '90 minutes', now() - interval '2 hours', now())`,
      [campaignId]
    )

    // ── Topics (5) ────────────────────────────────────────────────
    const topics = [
      'Design systems and component libraries',
      'Figma to code workflows',
      'Design tokens and theming',
      'Frontend accessibility automation',
      'Design engineering practices',
    ]
    for (let i = 0; i < topics.length; i++) {
      await dbQuery(
        `INSERT INTO ${t('campaign_topics')} (campaign_id, topic, source, confidence, order_index, approved, created_at)
         VALUES ($1, $2, 'llm', 0.9, $3, true, now())`,
        [campaignId, topics[i], i]
      )
    }

    // ── Search terms (15) ─────────────────────────────────────────
    const searchTerms: { term: string; category_tag: string; why_it_helps: string }[] = [
      { term: 'design system component library react', category_tag: 'product_category', why_it_helps: 'Directly targets engineers building component libraries' },
      { term: 'figma to react code generation', category_tag: 'product_category', why_it_helps: 'Exact workflow Pixelcraft automates' },
      { term: 'design tokens CSS variables best practices', category_tag: 'tutorial_format', why_it_helps: 'Design token users are core persona' },
      { term: 'storybook design system setup guide', category_tag: 'integration', why_it_helps: 'Storybook integration is key differentiator' },
      { term: 'WCAG accessibility automated testing', category_tag: 'product_category', why_it_helps: 'Accessibility automation is key feature' },
      { term: 'figma plugin developer tools 2024', category_tag: 'product_category', why_it_helps: 'Figma plugin ecosystem searchers' },
      { term: 'tailwind design system component library', category_tag: 'implementation', why_it_helps: 'Popular stack integration path' },
      { term: 'design engineer role frontend', category_tag: 'product_category', why_it_helps: 'Targets the exact job title persona' },
      { term: 'headless UI component library comparison', category_tag: 'competitor', why_it_helps: 'Comparison shoppers evaluating options' },
      { term: 'radix shadcn design system', category_tag: 'competitor', why_it_helps: 'Users of adjacent tools — natural upgrade path' },
      { term: 'responsive design system scaling', category_tag: 'problem_solution', why_it_helps: 'Scaling pain point Pixelcraft solves' },
      { term: 'design developer handoff tools', category_tag: 'problem_solution', why_it_helps: 'Core pain point — the handoff gap' },
      { term: 'CSS-in-JS vs design tokens', category_tag: 'tutorial_format', why_it_helps: 'Technical decision makers researching approaches' },
      { term: 'Figma variables to code', category_tag: 'implementation', why_it_helps: 'Specific Figma feature Pixelcraft leverages' },
      { term: 'component library documentation automation', category_tag: 'integration', why_it_helps: 'Docs generation is a Pixelcraft feature' },
    ]
    for (let i = 0; i < searchTerms.length; i++) {
      await dbQuery(
        `INSERT INTO ${t('campaign_search_terms')} (campaign_id, term, category_tag, why_it_helps, order_index, approved, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, now(), now())`,
        [campaignId, searchTerms[i].term, searchTerms[i].category_tag, searchTerms[i].why_it_helps, i]
      )
    }

    // ── Creator definitions ───────────────────────────────────────
    interface CreatorDef {
      name: string; handle: string; platform: string; url: string;
      subscriber_count: number | null; content_type: string;
      titles: string[]; slugPrefix: string;
    }

    const creators: CreatorDef[] = [
      {
        name: 'Kevin Powell', handle: 'kevinpowell', platform: 'youtube',
        url: 'https://youtube.com/@KevinPowell', subscriber_count: 1000000,
        content_type: 'youtube_video', slugPrefix: 'kp',
        titles: [
          'Container Queries Will Change How You Build Components',
          'The Only CSS Reset You Need in 2024',
          'Modern CSS Layout Techniques Every Developer Should Know',
          'Custom Properties Are More Powerful Than You Think',
          'Stop Using Pixels — Modern CSS Sizing Explained',
        ],
      },
      {
        name: 'Gary Simon', handle: 'designcourse', platform: 'youtube',
        url: 'https://youtube.com/@DesignCourse', subscriber_count: 1000000,
        content_type: 'youtube_video', slugPrefix: 'dc',
        titles: [
          'Design System Masterclass: From Figma to Production',
          'Build a Complete UI Kit in Figma — Full Course',
          'The State of UI/UX Design in 2024',
          'Responsive Design Without Media Queries',
          'From Design to Code: The Modern Workflow',
        ],
      },
      {
        name: 'Hyperplexed', handle: 'hyperplexed', platform: 'youtube',
        url: 'https://youtube.com/@Hyperplexed', subscriber_count: 656000,
        content_type: 'youtube_video', slugPrefix: 'hp',
        titles: [
          'I Rebuilt Stripe\'s Website Animations from Scratch',
          'Creative CSS Hover Effects You Need to Try',
          'Making Websites Feel Alive with Micro-Interactions',
          'The Most Satisfying CSS Gradients on the Internet',
          'I Cloned Apple\'s Design System in Pure CSS',
        ],
      },
      {
        name: 'Juxtopposed', handle: 'juxtopposed', platform: 'youtube',
        url: 'https://youtube.com/@juxtopposed', subscriber_count: 437000,
        content_type: 'youtube_video', slugPrefix: 'jx',
        titles: [
          'I Redesigned Figma\'s UI from Scratch',
          'Making Beautiful Dark Themes — A Complete Guide',
          'The Psychology of UI Color Palettes',
          'I Built a Design System in 48 Hours',
          'Why Every Design Looks the Same (And How to Fix It)',
        ],
      },
      {
        name: 'Jesse Showalter', handle: 'jesseshowalter', platform: 'youtube',
        url: 'https://youtube.com/@JesseShowalter', subscriber_count: 440000,
        content_type: 'youtube_video', slugPrefix: 'js',
        titles: [
          'Complete Figma Design System Tutorial 2024',
          'UI Design Process: From Brief to Handoff',
          'Figma Variables & Design Tokens — Complete Guide',
          'Portfolio Design That Gets You Hired',
          'The Tools Every UI Designer Needs in 2024',
        ],
      },
      {
        name: 'Sam Selikoff', handle: 'samselikoff', platform: 'youtube',
        url: 'https://youtube.com/@samselikoff', subscriber_count: 66000,
        content_type: 'youtube_video', slugPrefix: 'ss',
        titles: [
          'Rebuilding Linear\'s UI with React and Framer Motion',
          'Animated Tabs Component with Tailwind and React',
          'Building a Design System with Radix and Tailwind',
          'Responsive Framer Motion Animations',
          'The Future of React Component Architecture',
        ],
      },
      {
        name: 'Coder Coder', handle: 'thecodercoder', platform: 'youtube',
        url: 'https://youtube.com/@thecodercoder', subscriber_count: 400000,
        content_type: 'youtube_video', slugPrefix: 'cc',
        titles: [
          'Modern CSS Features That Replace JavaScript',
          'Building Accessible Components from Scratch',
          'CSS Container Queries — A Practical Guide',
          'From Sass to Modern CSS — Migration Guide',
          'Responsive Typography with CSS Clamp',
        ],
      },
      {
        name: 'Ahmad Shadeed', handle: 'shadeed', platform: 'devto',
        url: 'https://dev.to/shadeed', subscriber_count: null,
        content_type: 'article', slugPrefix: 'as',
        titles: [
          'Defensive CSS: Writing Resilient Stylesheets',
          'A Complete Guide to CSS Grid Areas',
          'The Art of CSS Layout Debugging',
          'Implementing Design Systems with Modern CSS',
          'Visual Guide to CSS Logical Properties',
        ],
      },
      {
        name: 'Stephanie Eckles', handle: '5t3ph', platform: 'devto',
        url: 'https://dev.to/5t3ph', subscriber_count: null,
        content_type: 'article', slugPrefix: 'se',
        titles: [
          'Modern CSS Solutions for Old Problems',
          'Building a Design Token Pipeline',
          'SmolCSS: Minimal Snippets for Modern Layouts',
          'Accessible Color Systems with CSS Custom Properties',
          'Enterprise Design Systems: Lessons from the Trenches',
        ],
      },
      {
        name: 'Emma Bostian', handle: 'emmabostian', platform: 'devto',
        url: 'https://dev.to/emmabostian', subscriber_count: null,
        content_type: 'article', slugPrefix: 'eb',
        titles: [
          'Design Systems at Spotify: What We Learned',
          'CSS Foundations Every Developer Should Master',
          'The Design-Engineering Spectrum',
          'Building Inclusive Component Libraries',
          'From Designer to Design Engineer: A Career Guide',
        ],
      },
    ]

    // ── Insert creators (upsert by handle+platform) ───────────────
    const creatorIdMap: Record<string, string> = {} // handle → id

    for (const cr of creators) {
      const existing = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('creators')} WHERE handle = $1 AND platform = $2 LIMIT 1`,
        [cr.handle, cr.platform]
      )
      if (existing.data.length === 0) {
        await dbQuery(
          `INSERT INTO ${t('creators')} (name, display_name, platform, handle, url, subscriber_count, content_language, relationship_status, notes, discovered_via, created_at, updated_at)
           VALUES ($1, $1, $2, $3, $4, $5, 'English', 'cold', '', 'manual', now(), now())`,
          [cr.name, cr.platform, cr.handle, cr.url, cr.subscriber_count]
        )
      }
      const fetched = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('creators')} WHERE handle = $1 AND platform = $2 LIMIT 1`,
        [cr.handle, cr.platform]
      )
      if (fetched.data[0]?.id) {
        creatorIdMap[cr.handle] = fetched.data[0].id
      }
    }

    // ── Content items (5 per creator = 50) ────────────────────────
    for (const cr of creators) {
      const creatorId = creatorIdMap[cr.handle]
      if (!creatorId) continue

      for (let i = 0; i < cr.titles.length; i++) {
        const num = i + 1
        const url = cr.platform === 'youtube'
          ? `https://youtube.com/watch?v=demo-${cr.slugPrefix}${num}`
          : `https://dev.to/${cr.handle}/demo-${cr.slugPrefix}${num}`
        const wordCount = 3000 + Math.floor(Math.random() * 5000)
        const daysAgo = 5 + Math.floor(Math.random() * 40)

        const existCI = await dbQuery<{ id: string }>(
          `SELECT id FROM ${t('content_items')} WHERE url = $1 LIMIT 1`, [url]
        )
        if (existCI.data.length > 0) continue

        await dbQuery(
          `INSERT INTO ${t('content_items')} (creator_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, ingestion_method, ingestion_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, now() - interval '${daysAgo} days', now(), 'English', '[transcript placeholder]', $6, 'seed', 'complete', now(), now())`,
          [creatorId, cr.platform, cr.content_type, cr.titles[i], url, wordCount]
        )
      }
    }

    // ── Campaign creators (all 10, all scored) ────────────────────
    const ccIdMap: Record<string, string> = {} // handle → campaign_creator id

    for (const cr of creators) {
      const creatorId = creatorIdMap[cr.handle]
      if (!creatorId) continue

      const existCC = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('campaign_creators')} WHERE campaign_id = $1 AND creator_id = $2 LIMIT 1`,
        [campaignId, creatorId]
      )
      if (existCC.data.length === 0) {
        await dbQuery(
          `INSERT INTO ${t('campaign_creators')} (campaign_id, creator_id, added_by_user_id, source, pipeline_stage, scoring_status, created_at, updated_at)
           VALUES ($1, $2, $3, 'db_match', 'scored', 'scored', now() - interval '3 days', now())`,
          [campaignId, creatorId, userId]
        )
      }
      const ccRow = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('campaign_creators')} WHERE campaign_id = $1 AND creator_id = $2 LIMIT 1`,
        [campaignId, creatorId]
      )
      if (ccRow.data[0]?.id) {
        ccIdMap[cr.handle] = ccRow.data[0].id
      }
    }

    // ── Evaluations, evidence, and content angles ─────────────────

    interface EvalDef {
      handle: string
      overall: number; technical: number; audience: number; quality: number; performance: number; brandFit: number
      coverage: string; nmr: boolean; nmrReason: string | null
      strengths: string[]; weaknesses: string[]; rationale: string
      evidence: { quote: string; dimension: string; why_it_matters: string; timestamp: number | null }[]
      angles: { title: string; format: string; persona: string; key_points: string[] }[]
    }

    const evalDefs: EvalDef[] = [
      // ── Kevin Powell ────────────────────────────────────────────
      {
        handle: 'kevinpowell',
        overall: 93, technical: 95, audience: 90, quality: 94, performance: 88, brandFit: 95,
        coverage: 'strong', nmr: false, nmrReason: null,
        strengths: [
          'Unmatched CSS expertise with deep understanding of modern layout, custom properties, and container queries — the exact primitives design systems are built on',
          'Authentic teaching style that earns trust from both beginners and seniors; 1M subscribers with unusually high comment engagement for educational content',
          'Already covers design tokens, responsive design, and component-level CSS patterns — natural alignment with Pixelcraft\'s Figma-to-code value prop',
        ],
        weaknesses: [
          'Pure CSS focus means React/component library content is secondary — would need a collaboration format that bridges CSS and React output',
          'Video length tends toward 20-40 minutes which limits shareability compared to shorter formats',
        ],
        rationale: 'Kevin is the most respected CSS educator on YouTube. His content on custom properties, container queries, and modern layout directly maps to the design token and component architecture space Pixelcraft operates in. His audience of frontend developers building production UIs is the exact persona Pixelcraft targets. A sponsored deep-dive on design tokens flowing from Figma to CSS custom properties would feel native to his existing content.',
        evidence: [
          { quote: 'Custom properties aren\'t just variables — they\'re the API layer of your design system. When you change a token at the root, every component updates. That\'s the power of a well-architected system.', dimension: 'technical_relevance', why_it_matters: 'Demonstrates deep understanding of design tokens — the core concept behind Pixelcraft\'s token extraction feature', timestamp: 342 },
          { quote: 'I see so many developers still writing one-off styles for every component. Container queries change everything — your components can finally be truly self-contained and responsive to their own context.', dimension: 'audience_alignment', why_it_matters: 'His audience is already thinking about component-level architecture, making them receptive to design system tooling', timestamp: 128 },
          { quote: 'The gap between what designers hand off in Figma and what developers actually build is where most of the friction lives. If we could automate that translation, teams would ship twice as fast.', dimension: 'brand_fit', why_it_matters: 'Directly articulates the design-to-code handoff problem that Pixelcraft solves', timestamp: 856 },
        ],
        angles: [
          { title: 'Design Tokens Deep Dive: From Figma to Production CSS', format: 'tutorial_video', persona: 'Design engineer building component libraries at a SaaS company', key_points: ['Show how design tokens flow from Figma variables to CSS custom properties', 'Demonstrate Pixelcraft\'s automatic token extraction vs manual workflow', 'Build a live theme switcher using extracted tokens'] },
          { title: 'Building a Responsive Component Library with Modern CSS', format: 'sponsored_tutorial', persona: 'Frontend lead standardizing a design system across multiple products', key_points: ['Container queries for self-contained responsive components', 'How Pixelcraft generates responsive-ready React components from Figma', 'Accessibility checks built into the component generation pipeline'] },
        ],
      },
      // ── Sam Selikoff ────────────────────────────────────────────
      {
        handle: 'samselikoff',
        overall: 91, technical: 94, audience: 86, quality: 92, performance: 80, brandFit: 93,
        coverage: 'strong', nmr: false, nmrReason: null,
        strengths: [
          'Builds polished React component demos that showcase exactly the kind of output Pixelcraft generates — Radix, Tailwind, Framer Motion are his core stack',
          'Targets senior frontend developers and design engineers who make tooling decisions — high-value, low-noise audience despite smaller subscriber count',
          'Content style emphasizes craftsmanship and attention to detail, aligning with Pixelcraft\'s quality-focused positioning',
        ],
        weaknesses: [
          'Smaller audience (66K) limits raw reach compared to other candidates on this list',
          'Publishes infrequently — averaging one video every 2-3 weeks — which means slower campaign momentum',
        ],
        rationale: 'Sam is the ideal design engineer creator for Pixelcraft. His videos on building component libraries with Radix and Tailwind directly demonstrate the workflow Pixelcraft automates. His audience skews senior and technical — exactly the decision-makers who would evaluate design-to-code tooling. The smaller audience is offset by extremely high relevance and influence within the design systems community.',
        evidence: [
          { quote: 'When I\'m building a component library, I want each piece to feel intentional. The spacing, the motion, the way it responds to different contexts — that\'s what separates a design system from a folder of components.', dimension: 'brand_fit', why_it_matters: 'His philosophy of intentional component design mirrors Pixelcraft\'s value proposition of translating design intent into code', timestamp: 215 },
          { quote: 'Radix gives you the behavior, Tailwind gives you the styling primitives, and then you just need to bridge the gap between what the designer envisioned and what you actually ship. That bridge is still mostly manual.', dimension: 'technical_relevance', why_it_matters: 'Directly identifies the Figma-to-code gap that Pixelcraft fills in the Radix/Tailwind ecosystem', timestamp: 487 },
          { quote: 'I rebuilt Linear\'s entire tab interface to understand their design system thinking. Every animation has a purpose. That level of craft is what we should aim for in our own component libraries.', dimension: 'content_quality', why_it_matters: 'Shows his commitment to reverse-engineering excellent design systems — content that naturally leads to tooling discussions', timestamp: 92 },
        ],
        angles: [
          { title: 'From Figma to Radix: Automating Component Library Setup', format: 'tutorial_video', persona: 'Design engineer building component libraries at a SaaS company', key_points: ['Walk through Pixelcraft\'s Figma-to-React pipeline with a real component', 'Compare manual Radix/Tailwind setup vs Pixelcraft-generated output', 'Show Storybook story auto-generation for the exported components'] },
          { title: 'The Design System Stack I\'d Use in 2024', format: 'opinion_video', persona: 'Frontend lead standardizing a design system across multiple products', key_points: ['Position Pixelcraft alongside Radix, Tailwind, and Framer Motion in the modern stack', 'Demonstrate how design tokens flow from Figma through the entire pipeline', 'Honest take on where auto-generation helps vs where manual craft is still needed'] },
        ],
      },
      // ── Gary Simon / DesignCourse ───────────────────────────────
      {
        handle: 'designcourse',
        overall: 90, technical: 88, audience: 92, quality: 86, performance: 92, brandFit: 90,
        coverage: 'strong', nmr: false, nmrReason: null,
        strengths: [
          'Massive design-focused audience (1M subs) that spans both designers and developers — ideal for Pixelcraft\'s cross-functional positioning',
          'Already produces Figma-to-code content as a core topic; his Design System Masterclass is exactly the format Pixelcraft would sponsor',
          'High production quality with strong visual demonstrations that make design tooling tangible and compelling',
        ],
        weaknesses: [
          'Content sometimes favors breadth over depth — his tutorials cover the happy path but may skip edge cases that senior engineers care about',
          'Has done multiple tool sponsorships which some viewers flag as repetitive — sponsored content needs to feel genuinely different from previous integrations',
        ],
        rationale: 'Gary bridges the designer-developer gap better than almost anyone on YouTube. His existing content on Figma workflows, design systems, and UI kits makes Pixelcraft a natural fit. His 1M subscribers include both designers who create in Figma and developers who implement in code — exactly the two sides Pixelcraft connects. A full-course-style integration would perform well given his format preferences.',
        evidence: [
          { quote: 'The biggest time sink in any product team is the handoff. The designer finishes in Figma, exports a PDF or a Zeplin link, and then the developer rebuilds everything from scratch. We need to kill this workflow.', dimension: 'brand_fit', why_it_matters: 'Directly names the handoff pain point that is Pixelcraft\'s core value proposition', timestamp: 156 },
          { quote: 'I built this entire UI kit in Figma with proper auto-layout, constraints, and variants. Now imagine if this could export directly to React components with all the responsive behavior intact.', dimension: 'technical_relevance', why_it_matters: 'Describes the exact Figma-to-React workflow that Pixelcraft enables — his audience is already primed for this solution', timestamp: 723 },
          { quote: 'Design systems aren\'t a nice-to-have anymore. If you\'re shipping a product with more than three pages and you don\'t have a component library, you\'re accumulating design debt every single sprint.', dimension: 'audience_alignment', why_it_matters: 'Frames design systems as essential — positioning that aligns with Pixelcraft\'s target buyer mindset', timestamp: 45 },
        ],
        angles: [
          { title: 'Design System Masterclass: Figma to React in One Click', format: 'full_course', persona: 'Product designer who codes and wants seamless Figma-to-React workflows', key_points: ['Build a complete design system in Figma with variables and variants', 'Use Pixelcraft to export production-ready React components', 'Show the design token extraction and Storybook generation in action'] },
          { title: 'The Design-to-Code Gap Is Finally Closing', format: 'opinion_video', persona: 'Frontend lead standardizing a design system across multiple products', key_points: ['Survey the current landscape of design-to-code tools', 'Demonstrate where Pixelcraft fits vs hand-coded approaches', 'Show real before/after comparisons of manual vs automated component creation'] },
        ],
      },
      // ── Ahmad Shadeed ───────────────────────────────────────────
      {
        handle: 'shadeed',
        overall: 89, technical: 92, audience: 84, quality: 94, performance: 78, brandFit: 90,
        coverage: 'strong', nmr: false, nmrReason: null,
        strengths: [
          'Recognized as a leading CSS architecture authority — his "Defensive CSS" series is widely cited in design system documentation across the industry',
          'Exceptional visual explanations of layout and component patterns that make complex CSS concepts accessible without dumbing them down',
          'Strong focus on real-world production CSS patterns that directly map to design system implementation challenges',
        ],
        weaknesses: [
          'Written content only — no video presence — which limits format flexibility for campaign activations',
          'Audience is more CSS-specialist than general frontend developer, potentially narrowing reach for a design-to-code tool',
        ],
        rationale: 'Ahmad\'s Defensive CSS methodology and his deep visual guides to layout patterns make him a natural authority for design system implementation content. His audience trusts his CSS recommendations implicitly, and his focus on resilient, production-ready patterns aligns with Pixelcraft\'s emphasis on generating robust components. A sponsored article series on design system CSS architecture would feel authentic to his existing body of work.',
        evidence: [
          { quote: 'A resilient design system anticipates the unexpected. What happens when the label is 40 characters? When the container is 200px wide? Defensive CSS is the foundation every component library needs.', dimension: 'technical_relevance', why_it_matters: 'His defensive CSS philosophy aligns with Pixelcraft\'s accessibility and resilience features in generated components', timestamp: null },
          { quote: 'I spent three days debugging a layout issue that came down to one missing logical property. This is why I believe visual debugging tools for CSS are not optional — they\'re essential for any team working at scale.', dimension: 'brand_fit', why_it_matters: 'Demonstrates the real cost of manual CSS work that Pixelcraft\'s automated generation eliminates', timestamp: null },
          { quote: 'CSS Grid areas give you a vocabulary to describe your layout intent. When designers and developers share that vocabulary, the handoff becomes a conversation instead of a translation exercise.', dimension: 'audience_alignment', why_it_matters: 'Frames the designer-developer communication gap in terms his audience deeply understands', timestamp: null },
        ],
        angles: [
          { title: 'Defensive CSS for Design Systems: A Visual Guide', format: 'sponsored_article', persona: 'Design engineer building component libraries at a SaaS company', key_points: ['Apply defensive CSS principles to design system components', 'Show how Pixelcraft\'s generated components handle edge cases automatically', 'Visual comparison of manually coded vs auto-generated resilient components'] },
          { title: 'From Figma Constraints to CSS Logical Properties', format: 'tutorial_article', persona: 'Product designer who codes and wants seamless Figma-to-React workflows', key_points: ['Map Figma auto-layout and constraints to CSS logical properties', 'Demonstrate how Pixelcraft preserves layout intent during code generation', 'Guide for designers who want to understand the CSS their designs produce'] },
        ],
      },
      // ── Hyperplexed ─────────────────────────────────────────────
      {
        handle: 'hyperplexed',
        overall: 88, technical: 85, audience: 88, quality: 92, performance: 90, brandFit: 84,
        coverage: 'strong', nmr: false, nmrReason: null,
        strengths: [
          'Creates viral-quality CSS and animation content that generates massive engagement — his Stripe rebuild got 2M views, proving he can make design tooling exciting',
          'Targets a younger, high-growth audience of frontend developers who are actively building their toolkits and making technology decisions',
          'Production quality is exceptional — every video is a polished demo that showcases what\'s possible with modern CSS and web tech',
        ],
        weaknesses: [
          'Content leans toward "cool factor" over practical application — may need creative framing to position Pixelcraft as more than just another tool',
          'Less focused on design systems specifically — his content is more about individual creative effects than systematic component architecture',
        ],
        rationale: 'Hyperplexed brings a creative energy that could make Pixelcraft\'s capabilities feel exciting rather than utilitarian. His audience of aspiring and growing frontend developers is at the stage where they\'re adopting design system tools for the first time. While his content isn\'t strictly design-system-focused, a "rebuild a production design system" format would bridge his creative style with Pixelcraft\'s capabilities.',
        evidence: [
          { quote: 'I rebuilt Stripe\'s entire landing page animation system from scratch. The amount of engineering that goes into making these micro-interactions feel right is insane — and most design tools completely ignore this layer.', dimension: 'content_quality', why_it_matters: 'Shows his ability to make complex design engineering work compelling and viral — valuable for campaign reach', timestamp: 67 },
          { quote: 'The best component libraries don\'t just handle the static states. They handle the transitions, the hover states, the loading states — all the moments between the Figma frame and the living product.', dimension: 'brand_fit', why_it_matters: 'Identifies the gap between static design and interactive components that Pixelcraft\'s generation addresses', timestamp: 334 },
          { quote: 'Pure CSS is more powerful than most developers realize. When you combine modern CSS with a solid design system, you can create experiences that feel like they required a JavaScript framework.', dimension: 'technical_relevance', why_it_matters: 'His CSS-first approach resonates with developers who want to reduce JS dependency — aligns with Pixelcraft\'s clean output', timestamp: 521 },
        ],
        angles: [
          { title: 'I Rebuilt a Production Design System in 24 Hours', format: 'challenge_video', persona: 'Design engineer building component libraries at a SaaS company', key_points: ['Speed-run building a design system using Pixelcraft\'s Figma export', 'Show the micro-interaction layer that Pixelcraft preserves from Figma prototypes', 'Compare the 24-hour Pixelcraft result vs weeks of manual component building'] },
          { title: 'Making Design Systems Feel Alive: Animation Patterns', format: 'tutorial_video', persona: 'Product designer who codes and wants seamless Figma-to-React workflows', key_points: ['Add motion design tokens to a Pixelcraft-generated component library', 'Show how Figma prototype animations map to CSS transitions and Framer Motion', 'Create a shared animation vocabulary between designers and developers'] },
        ],
      },
      // ── Juxtopposed ─────────────────────────────────────────────
      {
        handle: 'juxtopposed',
        overall: 87, technical: 82, audience: 88, quality: 90, performance: 88, brandFit: 86,
        coverage: 'strong', nmr: false, nmrReason: null,
        strengths: [
          'Unique designer-who-codes perspective that speaks directly to Pixelcraft\'s cross-functional persona — she redesigns UIs and then builds them',
          'High engagement from a design-savvy audience that cares about aesthetics, dark themes, and color theory — all design system fundamentals',
          'Content format of "I redesigned X" naturally lends itself to showcasing Figma-to-code workflows',
        ],
        weaknesses: [
          'More design-oriented than engineering-focused — may not resonate as deeply with the senior frontend lead persona',
          'Newer creator with less established credibility among enterprise design system decision-makers',
        ],
        rationale: 'Juxtopposed represents the emerging "design engineer" persona that Pixelcraft specifically targets. Her content sits at the exact intersection of Figma design and code implementation. Her 48-hour design system challenge and Figma redesign content naturally showcase the workflow Pixelcraft accelerates. She would be particularly effective at reaching designers who are starting to code and want tools that bridge both worlds.',
        evidence: [
          { quote: 'I redesigned Figma\'s entire UI because I wanted to understand what makes a design system feel cohesive. It\'s not just the components — it\'s the tokens, the spacing scale, the color relationships. Everything has to be intentional.', dimension: 'brand_fit', why_it_matters: 'Her focus on design system cohesion and intentionality mirrors Pixelcraft\'s approach to preserving design intent in code', timestamp: 189 },
          { quote: 'Building a design system in 48 hours taught me that the hard part isn\'t designing the components — it\'s translating them into code that respects the original design decisions. Every pixel of intent gets lost in translation.', dimension: 'technical_relevance', why_it_matters: 'Directly experiences the design-to-code translation pain that Pixelcraft eliminates', timestamp: 412 },
          { quote: 'Dark themes aren\'t just "invert the colors." You need a complete token system — surface levels, elevation, text hierarchy. If your design system doesn\'t handle this systematically, dark mode will always feel like an afterthought.', dimension: 'audience_alignment', why_it_matters: 'Her audience understands systematic design thinking and would appreciate tooling that automates token management', timestamp: 267 },
        ],
        angles: [
          { title: 'I Turned My Figma Design System into React Components Instantly', format: 'challenge_video', persona: 'Product designer who codes and wants seamless Figma-to-React workflows', key_points: ['Design a component library in Figma with proper tokens and variants', 'Use Pixelcraft to export the entire system to React in one click', 'Compare the generated output to her manual implementation'] },
          { title: 'Design System Theming: From Figma Variables to Live Code', format: 'tutorial_video', persona: 'Design engineer building component libraries at a SaaS company', key_points: ['Set up a complete Figma variable system for light and dark themes', 'Show Pixelcraft extracting and mapping tokens to CSS custom properties', 'Build a live theme switcher that respects all design decisions'] },
        ],
      },
      // ── Stephanie Eckles ────────────────────────────────────────
      {
        handle: '5t3ph',
        overall: 86, technical: 90, audience: 80, quality: 92, performance: 72, brandFit: 88,
        coverage: 'strong', nmr: false, nmrReason: null,
        strengths: [
          'Enterprise design system experience — her "Lessons from the Trenches" content speaks from real production experience that senior decision-makers respect',
          'Created SmolCSS and Modern CSS Solutions — established authority on the exact CSS patterns design systems consume',
          'Strong focus on design token pipelines and accessible color systems — directly maps to Pixelcraft\'s token extraction and WCAG features',
        ],
        weaknesses: [
          'Lower performance metrics compared to video creators — written content has inherently less viral reach on social platforms',
          'Niche audience — highly relevant but numerically smaller than YouTube-based creators on this list',
        ],
        rationale: 'Stephanie is one of the few creators who combines enterprise design system experience with hands-on CSS expertise. Her design token pipeline content directly describes the workflow Pixelcraft automates. Her accessibility-first approach to color systems aligns perfectly with Pixelcraft\'s WCAG compliance checking. She would be particularly effective at reaching the enterprise frontend lead persona who needs to justify design system tooling investments.',
        evidence: [
          { quote: 'Building a design token pipeline is the most impactful thing you can do for your design system. Tokens are the single source of truth that connects every layer — from Figma to CSS to documentation. Without them, you\'re just shipping disconnected components.', dimension: 'technical_relevance', why_it_matters: 'Describes exactly the token pipeline that Pixelcraft automates — her audience already understands the value', timestamp: null },
          { quote: 'I\'ve seen three enterprise design systems fail because they treated accessibility as a checkbox instead of a foundation. WCAG compliance has to be baked into your tokens and components from day one.', dimension: 'brand_fit', why_it_matters: 'Validates Pixelcraft\'s approach of building WCAG checking into the component generation pipeline', timestamp: null },
          { quote: 'Modern CSS has given us everything we need to build resilient, accessible component libraries without heavy JavaScript. Custom properties, container queries, :has() — these are design system primitives now.', dimension: 'audience_alignment', why_it_matters: 'Her audience thinks in terms of CSS primitives for design systems, making them natural evaluators of Pixelcraft\'s CSS output quality', timestamp: null },
        ],
        angles: [
          { title: 'The Enterprise Design Token Pipeline: From Figma to Production', format: 'sponsored_article', persona: 'Frontend lead standardizing a design system across multiple products', key_points: ['Map the typical enterprise design token workflow and its pain points', 'Show how Pixelcraft automates token extraction from Figma variables', 'Compare manual pipeline setup vs Pixelcraft-automated flow for a real token system'] },
          { title: 'Accessible Color Systems: Automated WCAG Compliance for Design Systems', format: 'tutorial_article', persona: 'Design engineer building component libraries at a SaaS company', key_points: ['Build an accessible color token system using CSS custom properties', 'Demonstrate Pixelcraft\'s automatic WCAG 2.1 AA compliance checking', 'Show how automated checking catches contrast failures that manual review misses'] },
        ],
      },
      // ── Jesse Showalter ─────────────────────────────────────────
      {
        handle: 'jesseshowalter',
        overall: 85, technical: 82, audience: 86, quality: 84, performance: 88, brandFit: 84,
        coverage: 'strong', nmr: false, nmrReason: null,
        strengths: [
          'Comprehensive Figma tutorials with strong SEO presence — his Design System Tutorial ranks high for Figma design system searches',
          'Targets designers transitioning to design engineering — the exact career moment when they adopt tools like Pixelcraft',
          'Practical, process-oriented content that walks through real workflows from brief to handoff — ideal format for tool integration',
        ],
        weaknesses: [
          'Content is more process-focused than technically deep — may not satisfy senior engineers looking for implementation details',
          'Audience skews toward independent designers and freelancers rather than product team leads who make enterprise purchasing decisions',
        ],
        rationale: 'Jesse\'s content lives at the design-to-code handoff that Pixelcraft eliminates. His Figma variables tutorial already covers the token workflow that feeds Pixelcraft, and his audience of designers learning to code is exactly the persona that would discover Pixelcraft. His process-focused style — showing the full journey from brief to delivery — provides a natural narrative for integrating Pixelcraft into a real workflow.',
        evidence: [
          { quote: 'Design tokens and Figma variables changed everything about how I work. Instead of copying hex values between tools, I have a single source of truth. But the gap between Figma variables and actual CSS is still a manual process that drives me crazy.', dimension: 'brand_fit', why_it_matters: 'Directly describes the pain point Pixelcraft solves — the gap between Figma variables and production CSS', timestamp: 445 },
          { quote: 'The handoff is where projects die. I\'ve watched designers spend weeks perfecting a system in Figma, only to see developers rebuild it from scratch because there\'s no clean way to translate design decisions into code.', dimension: 'technical_relevance', why_it_matters: 'Articulates the handoff problem from a designer\'s perspective — exactly the pain Pixelcraft addresses', timestamp: 178 },
          { quote: 'Every UI designer needs to understand how their designs translate to code. Not to become a developer, but to design systems that are actually buildable. The tools that bridge this gap are the most valuable tools in your stack.', dimension: 'audience_alignment', why_it_matters: 'His audience already believes in design-to-code bridging tools — they\'re primed to evaluate Pixelcraft', timestamp: 623 },
        ],
        angles: [
          { title: 'Complete Figma-to-React Workflow with Pixelcraft', format: 'tutorial_video', persona: 'Product designer who codes and wants seamless Figma-to-React workflows', key_points: ['Start with a real client brief and design a component library in Figma', 'Show Pixelcraft exporting the system to production React with design tokens', 'Walk through the generated Storybook stories and accessibility report'] },
          { title: 'Design Tokens in Practice: The Bridge Between Figma and Code', format: 'sponsored_tutorial', persona: 'Frontend lead standardizing a design system across multiple products', key_points: ['Set up Figma variables for a multi-brand design system', 'Use Pixelcraft to extract tokens and generate a CSS custom property system', 'Show how token changes in Figma propagate to code automatically'] },
        ],
      },
      // ── Coder Coder ─────────────────────────────────────────────
      {
        handle: 'thecodercoder',
        overall: 83, technical: 80, audience: 84, quality: 82, performance: 84, brandFit: 82,
        coverage: 'partial', nmr: false, nmrReason: null,
        strengths: [
          'Strong accessibility focus — her "Building Accessible Components from Scratch" series directly aligns with Pixelcraft\'s WCAG compliance feature',
          'Relatable teaching style that makes complex CSS approachable — high trust factor with junior-to-mid developers adopting their first design system tools',
          'Practical migration-focused content (Sass to Modern CSS) appeals to teams modernizing their frontend stack — natural Pixelcraft evaluation moment',
        ],
        weaknesses: [
          'Less authority with senior engineering audiences who make enterprise purchasing decisions — her audience skews earlier-career',
          'Content depth is solid but not cutting-edge — unlikely to drive thought leadership positioning that influences design system architects',
        ],
        rationale: 'Coder Coder\'s accessibility-focused content and practical CSS tutorials make her a good fit for reaching frontend developers who care about building things right. Her Sass migration content targets teams in the exact moment of modernization when they\'d evaluate new tooling. Coverage is partial because her design system content is less developed than her general CSS work, but her accessibility angle is a strong match for Pixelcraft\'s WCAG features.',
        evidence: [
          { quote: 'Building accessible components from scratch taught me that most accessibility failures come from the same handful of patterns. If we could automate those checks at the component level, we\'d catch 80% of issues before they reach production.', dimension: 'brand_fit', why_it_matters: 'Directly describes the automated accessibility checking that Pixelcraft provides in generated components', timestamp: 312 },
          { quote: 'Container queries aren\'t just a nice CSS feature — they fundamentally change how you think about component architecture. Your components can finally be responsive to their own context instead of the viewport. That\'s a design system game-changer.', dimension: 'technical_relevance', why_it_matters: 'Shows understanding of modern CSS features that Pixelcraft leverages in its component output', timestamp: 189 },
          { quote: 'Moving from Sass to modern CSS isn\'t just a syntax change. It\'s a chance to rethink your entire component architecture. Custom properties give you runtime theming that Sass variables never could.', dimension: 'audience_alignment', why_it_matters: 'Her migration-focused audience is at a natural decision point for adopting new design system tooling', timestamp: 534 },
        ],
        angles: [
          { title: 'Accessible Components: Manual vs Automated WCAG Checking', format: 'comparison_video', persona: 'Design engineer building component libraries at a SaaS company', key_points: ['Build a component manually and audit it for WCAG 2.1 AA compliance', 'Generate the same component with Pixelcraft and compare the accessibility output', 'Show how automated checking catches issues that manual testing misses'] },
          { title: 'Migrating Your Component Library to Modern CSS with Pixelcraft', format: 'tutorial_video', persona: 'Frontend lead standardizing a design system across multiple products', key_points: ['Start with a Sass-based component library and identify migration opportunities', 'Use Pixelcraft to generate modern CSS components from Figma designs', 'Compare the Sass-era workflow with the Pixelcraft-automated approach'] },
        ],
      },
      // ── Emma Bostian ────────────────────────────────────────────
      {
        handle: 'emmabostian',
        overall: 82, technical: 78, audience: 80, quality: 80, performance: 76, brandFit: 88,
        coverage: 'partial', nmr: true, nmrReason: 'Has shifted focus to management content recently. Verify current design systems content output before engagement.',
        strengths: [
          'Real enterprise design system experience at Spotify — her "Design Systems at Spotify: What We Learned" provides credibility that pure content creators lack',
          'Strong personal brand with cross-platform reach — Dev.to, Twitter, conferences — amplification beyond any single article',
          'Uniquely positioned at the design-engineering spectrum intersection, which is Pixelcraft\'s exact value proposition',
        ],
        weaknesses: [
          'Recent content has shifted toward engineering management and career guidance — may not currently be producing design systems technical content',
          'Writing frequency on Dev.to has decreased — last technical article was several weeks ago — unclear if she\'s still active in this space',
        ],
        rationale: 'Emma\'s Spotify design system experience and her "Design-Engineering Spectrum" positioning make her a high-credibility voice for Pixelcraft. Her enterprise background adds weight that pure content creators lack. However, her recent shift toward management content raises questions about current relevance. The NMR flag is set because her last several posts lean career/management rather than technical design systems — verify she\'s still actively producing content in this space before engaging.',
        evidence: [
          { quote: 'At Spotify, we learned that a design system is only as good as the workflow around it. The components were beautiful, but the handoff process was still broken. Designers would update tokens in Figma, and engineers wouldn\'t know about it for weeks.', dimension: 'brand_fit', why_it_matters: 'Describes the exact enterprise handoff pain that Pixelcraft solves — and from a credible enterprise source', timestamp: null },
          { quote: 'The design-engineering spectrum isn\'t about choosing a side. It\'s about having tools that let you operate fluidly across the whole range. The best design engineers I know think in both Figma and code simultaneously.', dimension: 'audience_alignment', why_it_matters: 'Her framing of the design engineer role validates the cross-functional persona Pixelcraft targets', timestamp: null },
          { quote: 'Building inclusive component libraries means thinking about accessibility from the token level up. Color contrast ratios, focus indicators, screen reader announcements — these can\'t be afterthoughts bolted onto finished components.', dimension: 'technical_relevance', why_it_matters: 'Her accessibility-first approach to component libraries aligns with Pixelcraft\'s WCAG compliance feature', timestamp: null },
        ],
        angles: [
          { title: 'Enterprise Design Systems: What I Learned at Spotify', format: 'sponsored_article', persona: 'Frontend lead standardizing a design system across multiple products', key_points: ['Share lessons from scaling Spotify\'s design system across multiple product teams', 'Show how Pixelcraft addresses the handoff failures she experienced at Spotify', 'Framework for evaluating design-to-code automation tools at enterprise scale'] },
          { title: 'The Design Engineer\'s Toolkit: Bridging Figma and React', format: 'tutorial_article', persona: 'Product designer who codes and wants seamless Figma-to-React workflows', key_points: ['Define the design engineer role and the tools that enable it', 'Walk through a Pixelcraft workflow from a design engineer\'s perspective', 'Show how inclusive components are generated with accessibility baked in'] },
        ],
      },
    ]

    // ── Insert evaluations, evidence, and angles ──────────────────
    for (const ev of evalDefs) {
      const ccId = ccIdMap[ev.handle]
      if (!ccId) continue

      const existEval = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('creator_evaluations')} WHERE campaign_creator_id = $1 LIMIT 1`, [ccId]
      )
      if (existEval.data.length > 0) continue

      await dbQuery(
        `INSERT INTO ${t('creator_evaluations')} (campaign_creator_id, model_provider, model_name, evaluated_at, evidence_coverage, needs_manual_review, needs_manual_review_reason,
          overall_score, score_technical_relevance, score_audience_alignment, score_content_quality, score_channel_performance, score_brand_fit,
          strengths_json, weaknesses_json, rationale_md, created_at, updated_at)
         VALUES ($1, 'anthropic', 'claude-sonnet-4-5-20250514', now() - interval '1 day', $2, $3, $4,
          $5, $6, $7, $8, $9, $10,
          $11::jsonb, $12::jsonb, $13, now(), now())`,
        [
          ccId, ev.coverage, ev.nmr, ev.nmrReason,
          ev.overall, ev.technical, ev.audience, ev.quality, ev.performance, ev.brandFit,
          JSON.stringify(ev.strengths), JSON.stringify(ev.weaknesses), ev.rationale,
        ]
      )

      // Get evaluation id
      const evalRow = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('creator_evaluations')} WHERE campaign_creator_id = $1 LIMIT 1`, [ccId]
      )
      const evalId = evalRow.data[0]?.id
      if (!evalId) continue

      // Get content items for this creator
      const creatorId = creatorIdMap[ev.handle]
      if (!creatorId) continue
      const creatorContent = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('content_items')} WHERE creator_id = $1 ORDER BY published_at DESC LIMIT 5`, [creatorId]
      )
      const ciIds = creatorContent.data.map(r => r.id)

      // Insert evidence snippets
      for (let i = 0; i < ev.evidence.length; i++) {
        const snippet = ev.evidence[i]
        const contentItemId = ciIds[i % ciIds.length]
        if (!contentItemId) continue

        await dbQuery(
          `INSERT INTO ${t('evidence_snippets')} (evaluation_id, content_item_id, quote, dimension, why_it_matters, timestamp_start_seconds, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
          [evalId, contentItemId, snippet.quote, snippet.dimension, snippet.why_it_matters, snippet.timestamp]
        )
      }

      // Insert content angles
      for (const angle of ev.angles) {
        await dbQuery(
          `INSERT INTO ${t('content_angles')} (evaluation_id, title, format, persona, key_points_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())`,
          [evalId, angle.title, angle.format, angle.persona, JSON.stringify(angle.key_points)]
        )
      }
    }

    // ── Activity log ──────────────────────────────────────────────
    interface ActivityDef {
      eventType: string
      creatorHandle?: string
      data: Record<string, unknown>
      daysAgo: number
      hoursAgo?: number
    }

    const activityDefs: ActivityDef[] = [
      { eventType: 'campaign_created', data: { campaign_name: 'Pixelcraft — Design Systems & DX' }, daysAgo: 7 },
      { eventType: 'discovery_started', data: { source: 'db_match', count: 10 }, daysAgo: 6, hoursAgo: 12 },
      { eventType: 'discovery_completed', data: { creators_found: 10, from_db: 7, from_llm: 3 }, daysAgo: 6, hoursAgo: 10 },
      { eventType: 'creator_evaluated', creatorHandle: 'kevinpowell', data: { score: 93, coverage: 'strong' }, daysAgo: 2, hoursAgo: 8 },
      { eventType: 'creator_evaluated', creatorHandle: 'samselikoff', data: { score: 91, coverage: 'strong' }, daysAgo: 2, hoursAgo: 7 },
      { eventType: 'creator_evaluated', creatorHandle: 'designcourse', data: { score: 90, coverage: 'strong' }, daysAgo: 2, hoursAgo: 6 },
      { eventType: 'creator_evaluated', creatorHandle: 'shadeed', data: { score: 89, coverage: 'strong' }, daysAgo: 2, hoursAgo: 5 },
      { eventType: 'creator_evaluated', creatorHandle: 'hyperplexed', data: { score: 88, coverage: 'strong' }, daysAgo: 2, hoursAgo: 4 },
      { eventType: 'creator_evaluated', creatorHandle: 'juxtopposed', data: { score: 87, coverage: 'strong' }, daysAgo: 2, hoursAgo: 3 },
      { eventType: 'creator_evaluated', creatorHandle: '5t3ph', data: { score: 86, coverage: 'strong' }, daysAgo: 1, hoursAgo: 10 },
      { eventType: 'creator_evaluated', creatorHandle: 'jesseshowalter', data: { score: 85, coverage: 'strong' }, daysAgo: 1, hoursAgo: 9 },
      { eventType: 'creator_evaluated', creatorHandle: 'thecodercoder', data: { score: 83, coverage: 'partial' }, daysAgo: 1, hoursAgo: 8 },
      { eventType: 'creator_evaluated', creatorHandle: 'emmabostian', data: { score: 82, coverage: 'partial', needs_manual_review: true }, daysAgo: 1, hoursAgo: 7 },
    ]

    for (const act of activityDefs) {
      const creatorId = act.creatorHandle ? creatorIdMap[act.creatorHandle] || null : null
      const interval = act.hoursAgo !== undefined
        ? `${act.daysAgo} days ${act.hoursAgo} hours`
        : `${act.daysAgo} days`
      await dbQuery(
        `INSERT INTO ${t('activity_log')} (campaign_id, creator_id, actor_user_id, event_type, event_data_json, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now() - interval '${interval}')`,
        [campaignId, creatorId, userId, act.eventType, JSON.stringify(act.data)]
      )
    }

    return NextResponse.json({
      message: 'Pixelcraft demo campaign seeded successfully',
      campaign_id: campaignId,
      creators: Object.keys(creatorIdMap).length,
      content_items: creators.length * 5,
      evaluations: evalDefs.length,
      evidence_snippets: evalDefs.reduce((acc, e) => acc + e.evidence.length, 0),
      content_angles: evalDefs.reduce((acc, e) => acc + e.angles.length, 0),
      activity_events: activityDefs.length,
    })
  } catch (e) {
    console.error('[seed-demo-campaign]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
