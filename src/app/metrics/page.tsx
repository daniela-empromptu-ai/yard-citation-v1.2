import { dbQuery, t } from '@/lib/db';
import MetricsDashboard from '@/components/metrics/MetricsDashboard';

export const dynamic = 'force-dynamic';

export default async function MetricsPage() {
  const [weeklyRes, campaignPerfRes, bookingRes] = await Promise.all([
    dbQuery<{ week: string; analyzed: number; approved: number; emails_sent: number }>(`
      SELECT
        DATE_TRUNC('week', cc.updated_at)::date as week,
        COUNT(*) FILTER (WHERE cc.scoring_status = 'scored') as analyzed,
        COUNT(*) FILTER (WHERE cc.pipeline_stage IN ('approved','outreach_ready','contacted','booked')) as approved,
        0 as emails_sent
      FROM ${t('campaign_creators')} cc
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 8
    `),
    dbQuery<{ campaign_name: string; client_name: string; analyzed: number; approved: number; sent: number; booked: number }>(`
      SELECT
        camp.name as campaign_name, cl.name as client_name,
        COUNT(cc.id) FILTER (WHERE cc.scoring_status = 'scored') as analyzed,
        COUNT(cc.id) FILTER (WHERE cc.pipeline_stage IN ('approved','outreach_ready','contacted','booked')) as approved,
        COUNT(oa.id) FILTER (WHERE oa.action_type = 'sent') as sent,
        COUNT(cc.id) FILTER (WHERE cc.outreach_state = 'booked') as booked
      FROM ${t('campaigns')} camp
      JOIN ${t('clients')} cl ON cl.id = camp.client_id
      LEFT JOIN ${t('campaign_creators')} cc ON cc.campaign_id = camp.id
      LEFT JOIN ${t('outreach_activity')} oa ON oa.campaign_creator_id = cc.id
      GROUP BY camp.id, cl.name
      ORDER BY analyzed DESC
    `),
    dbQuery<{ total_sent: number; total_booked: number }>(`
      SELECT
        COUNT(*) FILTER (WHERE action_type = 'sent') as total_sent,
        COUNT(DISTINCT cc.id) FILTER (WHERE cc.outreach_state = 'booked') as total_booked
      FROM ${t('outreach_activity')} oa
      JOIN ${t('campaign_creators')} cc ON cc.id = oa.campaign_creator_id
    `),
  ]);

  const bookingTotals = bookingRes.data[0] || { total_sent: 0, total_booked: 0 };
  const overallBookingRate = Number(bookingTotals.total_sent) > 0
    ? Math.round((Number(bookingTotals.total_booked) / Number(bookingTotals.total_sent)) * 100)
    : 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Ops Metrics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Creator analysis and outreach performance across all campaigns</p>
      </div>
      <MetricsDashboard
        weeklyData={weeklyRes.data}
        campaignPerf={campaignPerfRes.data}
        overallBookingRate={overallBookingRate}
        totalSent={Number(bookingTotals.total_sent)}
        totalBooked={Number(bookingTotals.total_booked)}
      />
    </div>
  );
}
