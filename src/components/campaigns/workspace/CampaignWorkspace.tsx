'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stageLabel } from '@/lib/utils';
import SetupTab from './SetupTab';
import SearchTermsTab from './SearchTermsTab';
import CreatorsTab from './CreatorsTab';
import ActivityTab from './ActivityTab';

interface CampaignCreatorRow {
  id: string; creator_id: string; creator_name: string; creator_platform: string;
  creator_handle: string | null; source: string | null;
  pipeline_stage: string; scoring_status: string;
  overall_score: number | null; evidence_coverage: string | null;
  needs_manual_review: boolean | null; evaluated_at: string | null;
  updated_at: string;
}

interface ActivityRow {
  id: string; event_type: string; actor_name: string | null; created_at: string;
  event_data_json: Record<string, unknown>; campaign_creator_id: string | null;
  creator_id: string | null;
}

interface PipelineJob {
  id: string; status: string; error_message: string | null;
  started_at: string | null; finished_at: string | null;
}

interface Props {
  campaign: {
    id: string; name: string; status: string; stage: string;
    geo_targets: string[]; product_category: string; creative_brief: string;
    language: string; client_name: string; owner_name: string;
    personas: string[]; gumshoe_notes: string | null;
    updated_at: string; owner_user_id: string;
  };
  topics: { id: string; campaign_id: string; topic: string; source: string; confidence: number | null; rationale: string | null; order_index: number; approved: boolean }[];
  searchTerms: { id: string; campaign_id: string; term: string; category_tag: string; why_it_helps: string; order_index: number; approved: boolean; approved_by_user_id: string | null; approved_at: string | null; notes: string | null }[];
  campaignCreators: CampaignCreatorRow[];
  activityLog: ActivityRow[];
  initialTab: string;
  pipelineJob?: PipelineJob | null;
}

export default function CampaignWorkspace({
  campaign, topics, searchTerms, campaignCreators, activityLog, initialTab, pipelineJob,
}: Props) {
  const [activeTab, setActiveTab] = useState(initialTab || 'setup');
  const [liveSearchTerms, setLiveSearchTerms] = useState(searchTerms);
  const router = useRouter();

  const hasApprovedTerms = liveSearchTerms.some(t => t.approved);
  const hasScoredCreators = campaignCreators.some(cc => cc.scoring_status === 'scored');
  const pipelineRunning = pipelineJob?.status === 'queued' || pipelineJob?.status === 'running';

  const TABS = [
    { id: 'setup', label: 'Setup', show: true },
    { id: 'search-terms', label: 'Search Terms', show: true, count: liveSearchTerms.length },
    { id: 'creators', label: 'Creators', show: hasApprovedTerms || campaignCreators.length > 0 || pipelineRunning, count: campaignCreators.filter(cc => cc.pipeline_stage !== 'excluded').length },
    { id: 'activity', label: 'Activity', show: true },
  ];

  const visibleTabs = TABS.filter(t => t.show);

  const stageColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    setup: 'bg-gray-100 text-gray-600',
    terms: 'bg-blue-100 text-blue-700',
    discovery: 'bg-cyan-100 text-cyan-700',
    scoring: 'bg-purple-100 text-purple-700',
    review: 'bg-orange-100 text-orange-700',
    complete: 'bg-gray-100 text-gray-500',
  };

  const handlePipelineStarted = () => {
    setActiveTab('creators');
    router.replace(`/campaigns/${campaign.id}/creators`, { scroll: false });
  };

  const tabProps = { campaign, topics, searchTerms: liveSearchTerms, campaignCreators, activityLog };

  return (
    <div className="flex flex-col h-full">
      {/* Campaign header */}
      <div className="px-6 pt-5 pb-0 bg-white border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/campaigns" className="text-xs text-gray-400 hover:text-gray-600">Campaigns</Link>
              <span className="text-xs text-gray-300">/</span>
              <span className="text-xs text-gray-600">{campaign.client_name}</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{campaign.name}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`badge text-xs ${campaign.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {campaign.status}
              </span>
              <span className={`badge text-xs ${stageColors[campaign.stage] || 'bg-gray-100 text-gray-600'}`}>
                Stage: {stageLabel(campaign.stage)}
              </span>
              {pipelineRunning && (
                <span className="badge text-xs bg-blue-100 text-blue-700 border-blue-200 animate-pulse">
                  Pipeline running...
                </span>
              )}
              {campaign.geo_targets && (
                <span className="text-xs text-gray-500">{(campaign.geo_targets as unknown as string[]).join(' \u00B7 ')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Owner: {campaign.owner_name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); router.replace(`/campaigns/${campaign.id}/${tab.id}`, { scroll: false }); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 badge bg-gray-100 text-gray-600 border-gray-200 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === 'setup' && <SetupTab {...tabProps} />}
          {activeTab === 'search-terms' && <SearchTermsTab {...tabProps} onPipelineStarted={handlePipelineStarted} onTermsUpdated={(t) => setLiveSearchTerms(t as typeof searchTerms)} />}
          {activeTab === 'creators' && <CreatorsTab {...tabProps} pipelineJob={pipelineJob} />}
          {activeTab === 'activity' && <ActivityTab {...tabProps} />}
        </div>
      </div>
    </div>
  );
}
