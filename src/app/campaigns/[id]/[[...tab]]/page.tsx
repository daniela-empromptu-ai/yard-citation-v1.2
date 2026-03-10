import { dbQuery, t } from '@/lib/db';
import { notFound } from 'next/navigation';
import CampaignWorkspace from '@/components/campaigns/workspace/CampaignWorkspace';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string; tab?: string[] };
}

export default async function CampaignPage({ params }: Props) {
  const { id } = params;
  const tab = params.tab?.[0] || 'setup';

  const [campRes, topicsRes, searchTermsRes, ccRes, activityRes, pipelineJobRes] = await Promise.all([
    dbQuery<{
      id: string; name: string; status: string; stage: string; language: string;
      geo_targets: string[]; product_category: string; creative_brief: string;
      personas: string[]; gumshoe_notes: string | null;
      created_at: string; updated_at: string;
      client_name: string; owner_name: string;
      client_id: string; owner_user_id: string;
    }>(`
      SELECT camp.*, cl.name as client_name, u.name as owner_name
      FROM ${t('campaigns')} camp
      JOIN ${t('clients')} cl ON cl.id = camp.client_id
      JOIN ${t('app_users')} u ON u.id = camp.owner_user_id
      WHERE camp.id = $1
    `, [id]),
    dbQuery<{ id: string; campaign_id: string; topic: string; source: string; confidence: number | null; rationale: string | null; order_index: number; approved: boolean }>(
      `SELECT * FROM ${t('campaign_topics')} WHERE campaign_id = $1 ORDER BY order_index`, [id]),
    dbQuery<{ id: string; campaign_id: string; term: string; category_tag: string; why_it_helps: string; order_index: number; approved: boolean; approved_by_user_id: string | null; approved_at: string | null; notes: string | null }>(
      `SELECT * FROM ${t('campaign_search_terms')} WHERE campaign_id = $1 ORDER BY order_index`, [id]),
    dbQuery<{
      id: string; creator_id: string; campaign_id: string;
      creator_name: string; creator_platform: string; creator_handle: string | null;
      source: string | null; pipeline_stage: string; scoring_status: string;
      overall_score: number | null; evidence_coverage: string | null;
      needs_manual_review: boolean | null; evaluated_at: string | null;
      updated_at: string;
    }>(`
      SELECT
        cc.id, cc.creator_id, cc.campaign_id, cc.source, cc.pipeline_stage, cc.scoring_status, cc.updated_at,
        cr.name as creator_name, cr.platform as creator_platform, cr.handle as creator_handle,
        e.overall_score, e.evidence_coverage, e.needs_manual_review, e.evaluated_at
      FROM ${t('campaign_creators')} cc
      JOIN ${t('creators')} cr ON cr.id = cc.creator_id
      LEFT JOIN ${t('creator_evaluations')} e ON e.campaign_creator_id = cc.id
      WHERE cc.campaign_id = $1
      ORDER BY e.overall_score DESC NULLS LAST, cc.created_at DESC
    `, [id]),
    dbQuery<{ id: string; event_type: string; actor_name: string | null; created_at: string; event_data_json: Record<string, unknown>; campaign_creator_id: string | null; creator_id: string | null }>(`
      SELECT al.*, u.name as actor_name
      FROM ${t('activity_log')} al
      LEFT JOIN ${t('app_users')} u ON u.id = al.actor_user_id
      WHERE al.campaign_id = $1
      ORDER BY al.created_at DESC
      LIMIT 50
    `, [id]),
    dbQuery<{
      id: string; status: string; error_message: string | null;
      started_at: string | null; finished_at: string | null;
    }>(`
      SELECT id, status, error_message, started_at, finished_at
      FROM ${t('jobs')}
      WHERE campaign_id = $1 AND type = 'full_pipeline'
      ORDER BY created_at DESC LIMIT 1
    `, [id]),
  ]);

  if (!campRes.success || campRes.data.length === 0) {
    notFound();
  }

  const campaign = campRes.data[0];
  const pipelineJob = pipelineJobRes.data[0] || null;

  return (
    <CampaignWorkspace
      campaign={campaign}
      topics={topicsRes.data}
      searchTerms={searchTermsRes.data}
      campaignCreators={ccRes.data}
      activityLog={activityRes.data}
      initialTab={tab}
      pipelineJob={pipelineJob}
    />
  );
}
