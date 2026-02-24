import { dbQuery, t } from '@/lib/db';
import { notFound } from 'next/navigation';
import CreatorProfileClient from '@/components/creators/CreatorProfile';

export const dynamic = 'force-dynamic';

export default async function CreatorProfilePage({ params }: { params: { id: string } }) {
  const [creatorRes, platformsRes, flagsRes, pricingRes, notesRes, contentRes, evaluationsRes, campaignsRes] = await Promise.all([
    dbQuery(`SELECT * FROM ${t('creators')} WHERE id = $1`, [params.id]),
    dbQuery(`SELECT * FROM ${t('creator_platform_accounts')} WHERE creator_id = $1 ORDER BY platform`, [params.id]),
    dbQuery(`SELECT csf.*, u.name as set_by_name FROM ${t('creator_status_flags')} csf LEFT JOIN ${t('app_users')} u ON u.id = csf.set_by_user_id WHERE csf.creator_id = $1 ORDER BY csf.set_at DESC`, [params.id]),
    dbQuery(`SELECT * FROM ${t('creator_pricing')} WHERE creator_id = $1`, [params.id]),
    dbQuery(`SELECT cn.*, u.name as created_by_name FROM ${t('creator_notes')} cn LEFT JOIN ${t('app_users')} u ON u.id = cn.created_by_user_id WHERE cn.creator_id = $1 ORDER BY cn.created_at DESC`, [params.id]),
    dbQuery(`SELECT id, title, url, platform, content_type, word_count, published_at, metadata_json FROM ${t('content_items')} WHERE creator_id = $1 ORDER BY published_at DESC NULLS LAST LIMIT 20`, [params.id]),
    dbQuery(`
      SELECT e.*, cc.pipeline_stage, camp.name as campaign_name, camp.id as campaign_id
      FROM ${t('creator_evaluations')} e
      JOIN ${t('campaign_creators')} cc ON cc.id = e.campaign_creator_id
      JOIN ${t('campaigns')} camp ON camp.id = cc.campaign_id
      WHERE cc.creator_id = $1
      ORDER BY e.evaluated_at DESC
    `, [params.id]),
    dbQuery(`
      SELECT cc.*, camp.name as campaign_name, cl.name as client_name, cc.outreach_state
      FROM ${t('campaign_creators')} cc
      JOIN ${t('campaigns')} camp ON camp.id = cc.campaign_id
      JOIN ${t('clients')} cl ON cl.id = camp.client_id
      WHERE cc.creator_id = $1
      ORDER BY cc.created_at DESC
    `, [params.id]),
  ]);

  if (!creatorRes.success || creatorRes.data.length === 0) notFound();

  return (
    <CreatorProfileClient
      creator={creatorRes.data[0]}
      platforms={platformsRes.data}
      flags={flagsRes.data}
      pricing={pricingRes.data}
      notes={notesRes.data}
      content={contentRes.data}
      evaluations={evaluationsRes.data}
      campaigns={campaignsRes.data}
    />
  );
}
