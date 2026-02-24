'use client';

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

interface Props {
  weeklyData: { week: string; analyzed: number; approved: number; emails_sent: number }[];
  campaignPerf: { campaign_name: string; client_name: string; analyzed: number; approved: number; sent: number; booked: number }[];
  overallBookingRate: number;
  totalSent: number;
  totalBooked: number;
}

export default function MetricsDashboard({ weeklyData, campaignPerf, overallBookingRate, totalSent, totalBooked }: Props) {
  const weeks = weeklyData.map(d => d.week ? new Date(d.week).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : '').reverse();
  const analyzed = weeklyData.map(d => Number(d.analyzed)).reverse();
  const approved = weeklyData.map(d => Number(d.approved)).reverse();

  const barData = {
    labels: weeks,
    datasets: [
      {
        label: 'Creators Analyzed',
        data: analyzed,
        backgroundColor: 'rgba(79, 70, 229, 0.7)',
        borderRadius: 4,
      },
      {
        label: 'Creators Approved',
        data: approved,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderRadius: 4,
      },
    ],
  };

  const bookingRateData = {
    labels: weeks.length > 0 ? weeks : ['No data'],
    datasets: [
      {
        label: 'Booking Rate %',
        data: weeks.map(() => overallBookingRate),
        borderColor: 'rgb(79, 70, 229)',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Baseline 7%',
        data: weeks.map(() => 7),
        borderColor: 'rgba(156, 163, 175, 0.5)',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Baseline 10%',
        data: weeks.map(() => 10),
        borderColor: 'rgba(156, 163, 175, 0.3)',
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'bottom' as const }, tooltip: { mode: 'index' as const } },
    scales: { y: { beginAtZero: true } },
  };

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-purple-700">{analyzed.reduce((a, b) => a + b, 0)}</div>
          <div className="text-xs text-gray-600 mt-1">Total Creators Analyzed</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-700">{approved.reduce((a, b) => a + b, 0)}</div>
          <div className="text-xs text-gray-600 mt-1">Total Approved for Outreach</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-teal-700">{totalSent}</div>
          <div className="text-xs text-gray-600 mt-1">Total Emails Sent</div>
          <div className="text-xs text-gray-400 mt-0.5">Baseline: 130/week</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-emerald-700">{overallBookingRate}%</div>
          <div className="text-xs text-gray-600 mt-1">Overall Booking Rate</div>
          <div className="text-xs text-gray-400 mt-0.5">Baseline: 7â10%</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Creators Analyzed & Approved per Week</h3>
          {weeks.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No data yet. Score creators to see weekly metrics.</div>
          ) : (
            <Bar data={barData} options={chartOptions} />
          )}
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Booking Rate Trend</h3>
          <Line data={bookingRateData} options={{
            ...chartOptions,
            scales: { y: { beginAtZero: true, max: 20 } },
          }} />
          <p className="text-xs text-gray-400 mt-2">Dashed lines show industry baselines (7% and 10%). Configure Anthropic and run scoring to see real trends.</p>
        </div>
      </div>

      {/* Campaign performance table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Campaign Performance Summary</h3>
        </div>
        {campaignPerf.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No campaigns with scoring data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Client</th>
                  <th className="text-right">Analyzed</th>
                  <th className="text-right">Approved</th>
                  <th className="text-right">Sent</th>
                  <th className="text-right">Booked</th>
                  <th className="text-right">Booking Rate</th>
                </tr>
              </thead>
              <tbody>
                {campaignPerf.map((cp, i) => {
                  const rate = Number(cp.sent) > 0 ? Math.round((Number(cp.booked) / Number(cp.sent)) * 100) : 0;
                  return (
                    <tr key={i}>
                      <td className="font-medium text-gray-900 max-w-xs truncate">{cp.campaign_name}</td>
                      <td className="text-gray-600 text-xs">{cp.client_name}</td>
                      <td className="text-right font-mono text-sm">{Number(cp.analyzed)}</td>
                      <td className="text-right font-mono text-sm">{Number(cp.approved)}</td>
                      <td className="text-right font-mono text-sm">{Number(cp.sent)}</td>
                      <td className="text-right font-mono text-sm">{Number(cp.booked)}</td>
                      <td className="text-right">
                        <span className={`font-mono text-sm font-semibold ${rate >= 10 ? 'text-green-700' : rate >= 7 ? 'text-yellow-700' : rate > 0 ? 'text-orange-700' : 'text-gray-400'}`}>
                          {rate > 0 ? `${rate}%` : 'â'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
