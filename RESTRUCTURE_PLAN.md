# Yard Citation V2 — Restructure Plan

Date: 2026-03-06

## Vision

Transform from a Google Sheets-based pipeline tool into a **creator discovery engine** where:
- The creator database is a persistent knowledge base (CRM for creators)
- Each creator row = one platform presence (brand/channel, not a person)
- Discovery is AI-driven (LLM look-alikes from topics + seed creators)
- Gumshoe citation data informs discovery (stubbed for V1, API available)
- Scoring evaluates shortlisted creators per-campaign using existing transcript + AI logic

---

## Database Schema

All tables use UUID primary keys. Foreign keys and constraints are enforced.
Builder API handles the actual Postgres — schema defined in `schema-def.ts`.

### Core Tables

```sql
-- Controlled niche/category taxonomy
categories (
  id          UUID PK DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  parent_id   UUID FK → categories.id NULLABLE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(name, parent_id)
)

-- The knowledge base: one row per platform presence
-- "Charity Majors on Medium" and "Charity Majors on YouTube" = two rows
creators (
  id                  UUID PK DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,                -- channel/brand name on that platform
  platform            TEXT NOT NULL,                -- youtube, medium, devto, linkedin, github, newsletter, podcast, blog
  handle              TEXT,                         -- @BretFisher, bretfisher, etc.
  url                 TEXT,                         -- full profile/channel URL
  platform_uid        TEXT,                         -- YouTube channel ID, etc.
  subscriber_count    INTEGER,
  content_language    TEXT DEFAULT 'English',
  relationship_status TEXT DEFAULT 'none',          -- none, cold, warm, hot
  too_expensive       BOOLEAN DEFAULT false,
  brand_owned         BOOLEAN DEFAULT false,
  excluded            BOOLEAN DEFAULT false,
  exclusion_reason    TEXT,
  notes               TEXT,
  discovered_via      TEXT DEFAULT 'manual',        -- manual, campaign_discovery, gumshoe
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(platform, platform_uid) WHERE platform_uid IS NOT NULL,
  UNIQUE(platform, handle) WHERE handle IS NOT NULL
)

-- Creator <> Category tagging (many-to-many)
creator_categories (
  creator_id   UUID NOT NULL FK → creators.id ON DELETE CASCADE,
  category_id  UUID NOT NULL FK → categories.id ON DELETE CASCADE,
  PRIMARY KEY (creator_id, category_id)
)
```

### Campaign Tables

```sql
campaigns (
  id                UUID PK DEFAULT gen_random_uuid(),
  client_id         UUID FK → clients.id,
  name              TEXT NOT NULL,
  owner_user_id     UUID FK → app_users.id,
  status            TEXT NOT NULL DEFAULT 'active',   -- active, paused, completed, archived
  stage             TEXT NOT NULL DEFAULT 'setup',    -- setup, terms, discovery, scoring, review
  creative_brief    TEXT,
  product_category  TEXT,
  geo_targets       TEXT[] DEFAULT '{}',
  language          TEXT DEFAULT 'English',
  gumshoe_report_id TEXT,                            -- for future API integration
  gumshoe_notes     TEXT,                            -- free-text Gumshoe context
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
)

campaign_topics (
  id           UUID PK DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL FK → campaigns.id ON DELETE CASCADE,
  topic        TEXT NOT NULL,
  source       TEXT DEFAULT 'manual',
  approved     BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(campaign_id, topic)
)

-- AI-generated search terms (used for scoring criteria)
campaign_search_terms (
  id              UUID PK DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL FK → campaigns.id ON DELETE CASCADE,
  term            TEXT NOT NULL,
  category_tag    TEXT,
  why_it_helps    TEXT,
  order_index     INTEGER DEFAULT 0,
  approved        BOOLEAN DEFAULT false,
  approved_by     UUID FK → app_users.id,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- Creators linked to a campaign
campaign_creators (
  id              UUID PK DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL FK → campaigns.id ON DELETE CASCADE,
  creator_id      UUID NOT NULL FK → creators.id ON DELETE CASCADE,
  added_by        UUID FK → app_users.id,
  source          TEXT DEFAULT 'db_match',          -- db_match, ai_discovery, manual, gumshoe
  pipeline_stage  TEXT DEFAULT 'discovered',        -- discovered, ingested, scored, excluded
  scoring_status  TEXT DEFAULT 'not_scored',        -- not_scored, scoring, scored, failed
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(campaign_id, creator_id)
)
```

### Scoring & Content Tables

```sql
-- Ingested content for scoring (transcripts, articles)
content_items (
  id                UUID PK DEFAULT gen_random_uuid(),
  creator_id        UUID NOT NULL FK → creators.id ON DELETE CASCADE,
  campaign_id       UUID FK → campaigns.id ON DELETE SET NULL,
  platform          TEXT NOT NULL,
  content_type      TEXT NOT NULL,
  title             TEXT,
  url               TEXT,
  published_at      TIMESTAMPTZ,
  raw_text          TEXT,
  word_count        INTEGER,
  language          TEXT,
  metadata_json     JSONB,
  ingestion_method  TEXT,
  ingestion_status  TEXT DEFAULT 'pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(url) WHERE url IS NOT NULL
)

-- AI evaluation results per campaign-creator
creator_evaluations (
  id                          UUID PK DEFAULT gen_random_uuid(),
  campaign_creator_id         UUID NOT NULL FK → campaign_creators.id ON DELETE CASCADE UNIQUE,
  overall_score               INTEGER,
  score_technical_relevance   INTEGER,
  score_audience_alignment    INTEGER,
  score_content_quality       INTEGER,
  score_channel_performance   INTEGER,
  score_brand_fit             INTEGER,
  evidence_coverage           TEXT,
  needs_manual_review         BOOLEAN DEFAULT false,
  needs_manual_review_reason  TEXT,
  strengths_json              JSONB,
  weaknesses_json             JSONB,
  rationale_md                TEXT,
  model_provider              TEXT,
  model_name                  TEXT,
  evaluated_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
)

evidence_snippets (
  id                       UUID PK DEFAULT gen_random_uuid(),
  evaluation_id            UUID NOT NULL FK → creator_evaluations.id ON DELETE CASCADE,
  content_item_id          UUID FK → content_items.id ON DELETE SET NULL,
  quote                    TEXT NOT NULL,
  dimension                TEXT,
  why_it_matters           TEXT,
  timestamp_start_seconds  INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
)

content_angles (
  id              UUID PK DEFAULT gen_random_uuid(),
  evaluation_id   UUID NOT NULL FK → creator_evaluations.id ON DELETE CASCADE,
  title           TEXT NOT NULL,
  format          TEXT,
  persona         TEXT,
  key_points_json JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

### Supporting Tables

```sql
app_users (
  id          UUID PK DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'analyst',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

clients (
  id          UUID PK DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

jobs (
  id             UUID PK DEFAULT gen_random_uuid(),
  type           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'queued',
  campaign_id    UUID FK → campaigns.id ON DELETE SET NULL,
  created_by     UUID FK → app_users.id,
  error_message  TEXT,
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)

job_events (
  id          UUID PK DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL FK → jobs.id ON DELETE CASCADE,
  level       TEXT NOT NULL,
  message     TEXT NOT NULL,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

activity_log (
  id                  UUID PK DEFAULT gen_random_uuid(),
  campaign_id         UUID FK → campaigns.id ON DELETE SET NULL,
  creator_id          UUID FK → creators.id ON DELETE SET NULL,
  campaign_creator_id UUID FK → campaign_creators.id ON DELETE SET NULL,
  actor_user_id       UUID FK → app_users.id,
  event_type          TEXT NOT NULL,
  event_data_json     JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

### Tables REMOVED from V1
- `campaign_personas` — not used in new flow
- `campaign_prompt_gaps` — not used in new flow
- `creator_contacts` — merged into creators table
- `creator_platform_accounts` — replaced by creators table (one row per platform)
- `creator_status_flags` — merged into creators (excluded, brand_owned, etc.)
- `evaluation_recommended_content` — unused
- `integration_status` — unused

### Future additions (not now)
- `linked_creator_id UUID FK → creators.id` on creators table — for cross-platform linking/merging
- Gumshoe `campaign_citations` table — when API integration is formalized

---

## Codebase Changes

### KEEP (adapt for new schema)
| File | Changes |
|------|---------|
| `src/lib/db.ts` | Add error checking on `dbQuery` responses |
| `src/lib/ai-actions.ts` | Add look-alike discovery prompt |
| `src/lib/score-creator.ts` | Update table references for new schema |
| `src/lib/youtube.ts` | Keep for scoring phase (channel resolution, transcript fetch) |
| `src/lib/evidence-validation.ts` | Keep as-is |
| `src/components/ui/*` | Keep all UI primitives |
| `src/app/layout.tsx`, Shell | Keep app shell, role switching |

### REWRITE
| File | New Purpose |
|------|-------------|
| `src/lib/schema-def.ts` | Full rewrite to new schema with FKs/constraints |
| `src/lib/schema-init.ts` | Update for new schema |
| `src/lib/pipeline.ts` | Split into separate discovery + scoring actions |
| `src/lib/prequalify.ts` | Simplify — only used in scoring phase, not discovery |
| `src/lib/seed.ts` / `seed-data.ts` | Seed categories only, no creator data |

### DELETE
| File | Reason |
|------|--------|
| `src/lib/google-sheets.ts` | Replaced by creator CRUD |
| `src/lib/discovery-scan.ts` | Replaced by LLM discovery |

### NEW
| File | Purpose |
|------|---------|
| `src/lib/discovery.ts` | LLM look-alike discovery (topics + seeds → new creators) |
| `src/lib/categories.ts` | Category CRUD helpers |
| `src/app/creators/page.tsx` | Spreadsheet-style creator database UI |
| `src/app/api/creators/*` | Creator CRUD API (list, create, update, delete) |
| `src/app/api/categories/*` | Category CRUD API |
| `src/app/api/campaigns/[id]/discover` | Rewritten: DB match + LLM discovery |

### CUT (not in V1)
| Feature | Reason |
|---------|--------|
| Outreach drafting + state tracking | V2 |
| Reddit integration | Not relevant |
| Metrics page | V2 |
| Settings page | Not needed |
| 5-tab workspace | Simplified campaign view |

---

## UX Flows

### Flow 1: Creator Database (primary view)
- Paginated table of all creators
- Columns: Name, Platform, Handle, Categories, Relationship Status, Flags, Notes
- Inline editing: relationship_status, too_expensive, brand_owned, notes
- Add creator manually (modal or inline row)
- Delete creator
- Filter by: category, platform, relationship status, flags
- Search by name/handle

### Flow 2: Campaign Creation
1. Name, client, topics, brief
2. Optional: paste Gumshoe context (free text field)
3. AI generates search terms from brief + topics (existing logic, for scoring)
4. User reviews/approves search terms
5. Campaign in "setup" stage

### Flow 3: Campaign Discovery ("Find Creators")
1. User clicks "Find Creators"
2. **Phase A — DB Match**: Query creators table by category overlap with campaign topics. Filter out excluded/brand_owned. Rank by relationship status.
3. **Phase B — LLM Discovery**: Send topics + brief + Gumshoe notes + optional seed creators to LLM. Get N new creator suggestions (name, platform, handle, topics).
4. Dedup against existing DB (platform + handle or platform + platform_uid)
5. New creators inserted with `discovered_via: 'campaign_discovery'`, auto-tagged with categories
6. All matched + new creators linked to campaign
7. Campaign stage → "discovery"

### Flow 4: Campaign Scoring ("Score Creators")
1. User clicks "Score Creators"
2. For each linked creator (YouTube/Medium/Blog):
   - Fetch transcript/content (existing logic)
   - AI scoring against search terms + brief (existing logic)
   - Save evaluation, evidence snippets, content angles
3. Results visible in campaign creator list
4. Campaign stage → "scoring" → "review"

---

## Implementation Order

### Phase 1: Schema + Creator Database
1. Rewrite `schema-def.ts` with new schema
2. Seed categories (DevOps, Kubernetes, CI/CD, Platform Engineering, etc.)
3. Fix `dbQuery` to check `success` responses
4. Creator CRUD API routes
5. Creator spreadsheet UI (table, inline edit, add/delete, filter, search, pagination)
6. Categories API + UI (manage controlled list)

### Phase 2: Campaign Basics
1. Adapt campaign create (remove personas/prompt gaps, add gumshoe_notes)
2. Keep search term generation
3. Simplified campaign detail page

### Phase 3: Discovery
1. Build LLM look-alike discovery prompt + logic
2. Phase A: DB category matching query
3. Phase B: LLM suggestions → dedup → insert → link
4. "Find Creators" button + results UI

### Phase 4: Scoring
1. Adapt scoring pipeline for new schema (creator = platform presence)
2. "Score Creators" as on-demand campaign action
3. Scoring results UI

### Phase 5: Polish
1. Dashboard
2. Activity log
3. Error handling + loading states
4. Pagination everywhere

---

## Open Questions
1. Category seed list — need full list from client
2. How many creators should LLM discovery suggest per run? (10? 20? 50?)
3. Gumshoe API auth — client provides API key when ready to integrate
