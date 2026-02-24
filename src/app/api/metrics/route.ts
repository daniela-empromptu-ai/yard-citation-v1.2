import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function GET() {
  try {
    const [analyzed, approved, emailsSent, booked, campaignPerf] = await Promise.all([
      // Creators analyzed per week (evaluations created)
      dbQuery(
        `SELECT date_trunc('week', evaluated_at) as week, COUNT(*)::int as count
         FROM creator_evaluations
         WHERE evaluated_at >= now() - interval '8 weeks'
         GROUP BY week ORDER BY week`,
        []
      ),
      // Approved per week
      dbQuery(
        `SELECT date_trunc('week', reviewed_at) as week, COUNT(*)::int as count
         FROM human_reviews WHERE decision = 'approved_for_outreach'
         AND reviewed_at >= now() - interval '8 weeks'
         GROUP BY week ORDER BY week`,
        []
      ),
      // Emails sent per week
      dbQuery(
        `SELECT date_trunc('week', occurred_at) as week, COUNT(*)::int as count
         FROM outreach_activity WHERE action_type = 'sent' AND channel = 'email'
         AND occurred_at >= now() - interval '8 weeks'
         GROUP BY week ORDER BY week`,
        []
      ),
      // Bookings
      dbQuery(
        `SELECT COUNT(*)::int as count FROM campaign_creators WHERE outreach_state = 'booked'`,
        []
      ),
      // Campaign performance
      dbQuery(
        `SELECT camp.name, camp.stage,
           COUNT(DISTINCT cc.id)::int as analyzed,
           COUNT(DISTINCT CASE WHEN hr.decision = 'approved_for_outreach' THEN cc.id END)::int as approved,
           COUNT(DISTINCT CASE WHEN cc.outreach_state = 'sent' THEN cc.id END)::int as sent,
           COUNT(DISTINCT CASE WHEN cc.outreach_state = 'booked' THEN cc.id END)::int as booked
         FROM campaigns camp
         LEFT JOIN campaign_creators cc ON cc.campaign_id = camp.id
         LEFT JOIN human_reviews hr ON hr.campaign_creator_id = cc.id
         WHERE camp.status = 'active'
         GROUP BY camp.id, camp.name, camp.stage
         ORDER BY camp.name`,
        []
      ),
    ])

    const bookedCount = (booked.data[0] as Record<string, number>)?.count || 0
    const sentCount = (emailsSent.data as Record<string, number>[]).reduce((a, b) => a + (b.count || 0), 0)
    const bookingRate = sentCount > 0 ? ((bookedCount / sentCount) * 100).toFixed(1) : '0.0'

    return NextResponse.json({
      analyzed: analyzed.data,
      approved: approved.data,
      emailsSent: emailsSent.data,
      bookedCount,
      sentCount,
      bookingRate,
      campaignPerf: campaignPerf.data,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
