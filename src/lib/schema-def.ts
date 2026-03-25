// V2 schema definition — 16 tables (down from 34).
// Creator = platform presence (not a person). One row per platform.
// FK relationships documented in comments; enforced at app level
// (builder API schema format doesn't support FK declarations).

export const SCHEMA_DEF = {
  tables: [
    // ── Identity & access ──────────────────────────────────────────
    {
      name: 'app_users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'name', type: 'text', nullable: false },
        { name: 'email', type: 'text', nullable: false },
        { name: 'role', type: 'text', nullable: false },
        { name: 'password_hash', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },
    {
      name: 'clients',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'name', type: 'text', nullable: false },
        { name: 'website_url', type: 'text', nullable: true },
        { name: 'notes', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },

    // ── Categories (controlled niche taxonomy) ─────────────────────
    {
      name: 'categories',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'name', type: 'text', nullable: false },
        { name: 'parent_id', type: 'uuid', nullable: true }, // FK → categories.id
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },

    // ── Creators (one row per platform presence) ───────────────────
    {
      name: 'creators',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'name', type: 'text', nullable: false },
        { name: 'platform', type: 'text', nullable: false },
        { name: 'handle', type: 'text', nullable: true },
        { name: 'url', type: 'text', nullable: true },
        { name: 'platform_uid', type: 'text', nullable: true },
        { name: 'subscriber_count', type: 'integer', nullable: true },
        { name: 'content_language', type: 'text', nullable: true },
        { name: 'relationship_status', type: 'text', nullable: true },
        { name: 'too_expensive', type: 'boolean', nullable: false, default: 'false' },
        { name: 'brand_owned', type: 'boolean', nullable: false, default: 'false' },
        { name: 'excluded', type: 'boolean', nullable: false, default: 'false' },
        { name: 'exclusion_reason', type: 'text', nullable: true },
        { name: 'notes', type: 'text', nullable: true },
        { name: 'discovered_via', type: 'text', nullable: true },
        { name: 'email', type: 'text', nullable: true },
        { name: 'contact_method', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },

    // ── Creator ↔ Category join ────────────────────────────────────
    {
      name: 'creator_categories',
      columns: [
        { name: 'creator_id', type: 'uuid', nullable: false }, // FK → creators.id
        { name: 'category_id', type: 'uuid', nullable: false }, // FK → categories.id
      ],
    },

    // ── Campaigns ──────────────────────────────────────────────────
    {
      name: 'campaigns',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'client_id', type: 'uuid', nullable: false }, // FK → clients.id
        { name: 'name', type: 'text', nullable: false },
        { name: 'owner_user_id', type: 'uuid', nullable: false }, // FK → app_users.id
        { name: 'status', type: 'text', nullable: false, default: "'draft'" },
        { name: 'stage', type: 'text', nullable: false, default: "'draft'" },
        { name: 'geo_targets', type: 'text[]', nullable: false, default: "'{}'" },
        { name: 'language', type: 'text', nullable: false, default: "'English'" },
        { name: 'product_category', type: 'text', nullable: true },
        { name: 'creative_brief', type: 'text', nullable: true },
        { name: 'gumshoe_report_id', type: 'text', nullable: true },
        { name: 'personas', type: 'text[]', nullable: false, default: "'{}'" },
        { name: 'gumshoe_notes', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },
    {
      name: 'campaign_topics',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'campaign_id', type: 'uuid', nullable: false }, // FK → campaigns.id
        { name: 'topic', type: 'text', nullable: false },
        { name: 'source', type: 'text', nullable: false, default: "'manual'" },
        { name: 'confidence', type: 'numeric', nullable: true },
        { name: 'rationale', type: 'text', nullable: true },
        { name: 'order_index', type: 'integer', nullable: false, default: '0' },
        { name: 'approved', type: 'boolean', nullable: false, default: 'true' },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },
    {
      name: 'campaign_search_terms',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'campaign_id', type: 'uuid', nullable: false }, // FK → campaigns.id
        { name: 'term', type: 'text', nullable: false },
        { name: 'category_tag', type: 'text', nullable: false },
        { name: 'why_it_helps', type: 'text', nullable: false },
        { name: 'order_index', type: 'integer', nullable: false, default: '0' },
        { name: 'approved', type: 'boolean', nullable: false, default: 'false' },
        { name: 'approved_by_user_id', type: 'uuid', nullable: true }, // FK → app_users.id
        { name: 'approved_at', type: 'timestamptz', nullable: true },
        { name: 'notes', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },

    // ── Campaign ↔ Creator join (simplified) ───────────────────────
    {
      name: 'campaign_creators',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'campaign_id', type: 'uuid', nullable: false }, // FK → campaigns.id
        { name: 'creator_id', type: 'uuid', nullable: false }, // FK → creators.id
        { name: 'added_by_user_id', type: 'uuid', nullable: false }, // FK → app_users.id
        { name: 'source', type: 'text', nullable: true },
        { name: 'pipeline_stage', type: 'text', nullable: false, default: "'discovered'" },
        { name: 'scoring_status', type: 'text', nullable: false, default: "'not_scored'" },
        { name: 'notes', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },

    // ── Content & scoring ──────────────────────────────────────────
    {
      name: 'content_items',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'creator_id', type: 'uuid', nullable: false }, // FK → creators.id
        { name: 'campaign_id', type: 'uuid', nullable: true }, // FK → campaigns.id
        { name: 'platform', type: 'text', nullable: false },
        { name: 'content_type', type: 'text', nullable: false },
        { name: 'title', type: 'text', nullable: false },
        { name: 'url', type: 'text', nullable: false },
        { name: 'published_at', type: 'timestamptz', nullable: true },
        { name: 'fetched_at', type: 'timestamptz', nullable: true },
        { name: 'language', type: 'text', nullable: true },
        { name: 'raw_text', type: 'text', nullable: false },
        { name: 'word_count', type: 'integer', nullable: true },
        { name: 'metadata_json', type: 'jsonb', nullable: false, default: "'{}'::jsonb" },
        { name: 'ingestion_method', type: 'text', nullable: false, default: "'seed'" },
        { name: 'ingestion_status', type: 'text', nullable: false, default: "'complete'" },
        { name: 'ingestion_error', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },
    {
      name: 'creator_evaluations',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'campaign_creator_id', type: 'uuid', nullable: false }, // FK → campaign_creators.id
        { name: 'model_provider', type: 'text', nullable: false },
        { name: 'model_name', type: 'text', nullable: false },
        { name: 'evaluated_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'evidence_coverage', type: 'text', nullable: false, default: "'none'" },
        { name: 'needs_manual_review', type: 'boolean', nullable: false, default: 'false' },
        { name: 'needs_manual_review_reason', type: 'text', nullable: true },
        { name: 'overall_score', type: 'integer', nullable: false, default: '0' },
        { name: 'score_technical_relevance', type: 'integer', nullable: false, default: '0' },
        { name: 'score_audience_alignment', type: 'integer', nullable: false, default: '0' },
        { name: 'score_content_quality', type: 'integer', nullable: false, default: '0' },
        { name: 'score_channel_performance', type: 'integer', nullable: false, default: '0' },
        { name: 'score_brand_fit', type: 'integer', nullable: false, default: '0' },
        { name: 'strengths_json', type: 'jsonb', nullable: false, default: "'[]'::jsonb" },
        { name: 'weaknesses_json', type: 'jsonb', nullable: false, default: "'[]'::jsonb" },
        { name: 'rationale_md', type: 'text', nullable: false },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },
    {
      name: 'evidence_snippets',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'evaluation_id', type: 'uuid', nullable: false }, // FK → creator_evaluations.id
        { name: 'content_item_id', type: 'uuid', nullable: true }, // FK → content_items.id (SET NULL)
        { name: 'timestamp_start_seconds', type: 'integer', nullable: true },
        { name: 'timestamp_end_seconds', type: 'integer', nullable: true },
        { name: 'quote', type: 'text', nullable: false },
        { name: 'dimension', type: 'text', nullable: false },
        { name: 'why_it_matters', type: 'text', nullable: false },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },
    {
      name: 'content_angles',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'evaluation_id', type: 'uuid', nullable: false }, // FK → creator_evaluations.id
        { name: 'title', type: 'text', nullable: false },
        { name: 'persona', type: 'text', nullable: true },
        { name: 'format', type: 'text', nullable: false },
        { name: 'key_points_json', type: 'jsonb', nullable: false, default: "'[]'::jsonb" },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },

    // ── Operational ────────────────────────────────────────────────
    {
      name: 'activity_log',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'campaign_id', type: 'uuid', nullable: true },
        { name: 'creator_id', type: 'uuid', nullable: true },
        { name: 'campaign_creator_id', type: 'uuid', nullable: true },
        { name: 'actor_user_id', type: 'uuid', nullable: true },
        { name: 'event_type', type: 'text', nullable: false },
        { name: 'event_data_json', type: 'jsonb', nullable: false, default: "'{}'::jsonb" },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },
    {
      name: 'jobs',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'type', type: 'text', nullable: false },
        { name: 'status', type: 'text', nullable: false, default: "'queued'" },
        { name: 'campaign_id', type: 'uuid', nullable: true },
        { name: 'error_message', type: 'text', nullable: true },
        { name: 'started_at', type: 'timestamptz', nullable: true },
        { name: 'finished_at', type: 'timestamptz', nullable: true },
        { name: 'created_by_user_id', type: 'uuid', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },
    {
      name: 'job_events',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'job_id', type: 'uuid', nullable: false }, // FK → jobs.id
        { name: 'level', type: 'text', nullable: false },
        { name: 'message', type: 'text', nullable: false },
        { name: 'meta', type: 'jsonb', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
      ],
    },
  ],
  indexes: [
    // app_users
    { table: 'app_users', columns: ['email'], name: 'app_users_email_uq', unique: true },
    // clients
    { table: 'clients', columns: ['name'], name: 'clients_name_uq', unique: true },
    // categories
    { table: 'categories', columns: ['name', 'parent_id'], name: 'categories_name_parent_uq', unique: true },
    // creators
    { table: 'creators', columns: ['name'], name: 'creators_name_idx' },
    { table: 'creators', columns: ['platform'], name: 'creators_platform_idx' },
    { table: 'creators', columns: ['platform', 'handle'], name: 'creators_platform_handle_uq', unique: true },
    { table: 'creators', columns: ['platform', 'platform_uid'], name: 'creators_platform_uid_uq', unique: true },
    // creator_categories (composite PK via unique index)
    { table: 'creator_categories', columns: ['creator_id', 'category_id'], name: 'creator_categories_pk', unique: true },
    // campaigns
    { table: 'campaigns', columns: ['client_id'], name: 'campaigns_client_id_idx' },
    { table: 'campaigns', columns: ['owner_user_id'], name: 'campaigns_owner_idx' },
    { table: 'campaigns', columns: ['status'], name: 'campaigns_status_idx' },
    { table: 'campaigns', columns: ['stage'], name: 'campaigns_stage_idx' },
    // campaign_topics
    { table: 'campaign_topics', columns: ['campaign_id', 'topic'], name: 'campaign_topics_uq', unique: true },
    { table: 'campaign_topics', columns: ['campaign_id'], name: 'campaign_topics_campaign_idx' },
    // campaign_search_terms
    { table: 'campaign_search_terms', columns: ['campaign_id'], name: 'cst_campaign_idx' },
    { table: 'campaign_search_terms', columns: ['approved'], name: 'cst_approved_idx' },
    // campaign_creators
    { table: 'campaign_creators', columns: ['campaign_id', 'creator_id'], name: 'cc_campaign_creator_uq', unique: true },
    { table: 'campaign_creators', columns: ['campaign_id'], name: 'cc_campaign_idx' },
    { table: 'campaign_creators', columns: ['creator_id'], name: 'cc_creator_idx' },
    { table: 'campaign_creators', columns: ['pipeline_stage'], name: 'cc_stage_idx' },
    // content_items
    { table: 'content_items', columns: ['url'], name: 'ci_url_uq', unique: true },
    { table: 'content_items', columns: ['creator_id'], name: 'ci_creator_idx' },
    { table: 'content_items', columns: ['campaign_id'], name: 'ci_campaign_idx' },
    // creator_evaluations
    { table: 'creator_evaluations', columns: ['campaign_creator_id'], name: 'ce_cc_uq', unique: true },
    // evidence_snippets
    { table: 'evidence_snippets', columns: ['evaluation_id'], name: 'es_eval_idx' },
    // activity_log
    { table: 'activity_log', columns: ['campaign_id'], name: 'al_campaign_idx' },
    { table: 'activity_log', columns: ['created_at'], name: 'al_created_at_idx' },
    // jobs
    { table: 'jobs', columns: ['status'], name: 'jobs_status_idx' },
  ],
}
