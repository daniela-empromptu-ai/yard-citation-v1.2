import { dbQuery, t } from '@/lib/db';
import { notFound } from 'next/navigation';
import CampaignWorkspace from '@/components/campaigns/workspace/CampaignWorkspace';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
  searchParams: { tab?: string };
}

export default async function CampaignPage({ params, searchParams }: Props) {
  const { id } = params;
  const tab = searchParams.tab || 'overview';

  // Load campaign + related data in parallel
  const [campRes, personasRes, topicsRes, gapsRes, searchTermsRes, ccRes, activityRes] = await Promise.all([
    dbQuery<{
      id: string; name: string; status: string; stage: string; language: string;
      geo_targets: string[]; product_category: string; creative_brief: string;
      additional_prompt_context: string; created_at: string; updated_at: string;
      client_name: string; owner_name: string; collaborator_name: string | null;
      client_id: string; owner_user_id: string;
    }>(`
      SELECT camp.*, cl.name as client_name, u.name as owner_name, u2.name as collaborator_name
      FROM ${t('campaigns')} camp
      JOIN ${t('clients')} cl ON cl.id = camp.client_id
      JOIN ${t('app_users')} u ON u.id = camp.owner_user_id
      LEFT JOIN ${t('app_users')} u2 ON u2.id = camp.collaborator_user_id
      WHERE camp.id = $1
    `, [id]),
    dbQuery(`SELECT * FROM ${t('campaign_personas')} WHERE campaign_id = $1`, [id]),
    dbQuery(`SELECT * FROM ${t('campaign_topics')} WHERE campaign_id = $1 ORDER BY order_index`, [id]),
    dbQuery(`SELECT * FROM ${t('campaign_prompt_gaps')} WHERE campaign_id = $1 ORDER BY priority, created_at`, [id]),
    dbQuery(`SELECT * FROM ${t('campaign_search_terms')} WHERE campaign_id = $1 ORDER BY order_index`, [id]),
    dbQuery(`
      SELECT
        cc.*,
        c.display_name as creator_name, c.primary_handle, c.is_dormant, c.is_autodubbed_suspected,
        c.competitor_affiliated, c.last_content_date, c.topics as creator_topics, c.languages,
        e.overall_score, e.evidence_coverage, e.needs_manual_review, e.evaluated_at,
        u.name as owner_name
      FROM ${t('campaign_creators')} cc
      JOIN ${t('creators')} c ON c.id = cc.creator_id
      LEFT JOIN ${t('creator_evaluations')} e ON e.campaign_creator_id = cc.id
      LEFT JOIN ${t('app_users')} u ON u.id = cc.outreach_owner_user_id
      WHERE cc.campaign_id = $1
      ORDER BY cc.created_at DESC
    `, [id]),
    dbQuery(`
      SELECT al.*, u.name as actor_name
      FROM ${t('activity_log')} al
      LEFT JOIN ${t('app_users')} u ON u.id = al.actor_user_id
      WHERE al.campaign_id = $1
      ORDER BY al.created_at DESC
      LIMIT 50
    `, [id]),
  ]);

  if (!campRes.success || campRes.data.length === 0) {
    notFound();
  }

  const campaign = campRes.data[0];

  return (
    <CampaignWorkspace
      campaign={campaign}
      personas={personasRes.data}
      topics={topicsRes.data}
      promptGaps={gapsRes.data}
      searchTerms={searchTermsRes.data}
      campaignCreators={ccRes.data}
      activityLog={activityRes.data}
      initialTab={tab}
    />
  );
}
