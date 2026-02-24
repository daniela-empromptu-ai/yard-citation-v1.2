'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stageLabel, pipelineStageColor } from '@/lib/utils';
import OverviewTab from './OverviewTab';
import BriefInputsTab from './BriefInputsTab';
import SearchTermsTab from './SearchTermsTab';
import DiscoveryTab from './DiscoveryTab';
import IngestionTab from './IngestionTab';
import ScoringTab from './ScoringTab';
import ReviewTab from './ReviewTab';
import OutreachTab from './OutreachTab';
import ActivityTab from './ActivityTab';
import RedditTab from './RedditTab';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'brief-inputs', label: 'Brief & Inputs' },
  { id: 'search-terms', label: 'Search Terms' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'ingestion', label: 'Ingestion' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'review', label: 'Review' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'activity', label: 'Activity' },
];

interface Props {
  campaign: {
    id: string; name: string; status: string; stage: string;
    geo_targets: string[]; product_category: string; creative_brief: string;
    language: string; client_name: string; owner_name: string; collaborator_name: string | null;
    additional_prompt_context: string | null; updated_at: string; owner_user_id: string;
  };
  personas: unknown[];
  topics: unknown[];
  promptGaps: unknown[];
  searchTerms: unknown[];
  campaignCreators: unknown[];
  activityLog: unknown[];
  initialTab: string;
}

export default function CampaignWorkspace({
  campaign, personas, topics, promptGaps, searchTerms, campaignCreators, activityLog, initialTab,
}: Props) {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const router = useRouter();

  const stageColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    terms: 'bg-blue-100 text-blue-700',
    discovery: 'bg-cyan-100 text-cyan-700',
    ingestion: 'bg-indigo-100 text-indigo-700',
    scoring: 'bg-purple-100 text-purple-700',
    review: 'bg-orange-100 text-orange-700',
    outreach: 'bg-green-100 text-green-700',
    tracking: 'bg-teal-100 text-teal-700',
    complete: 'bg-gray-100 text-gray-500',
  };

  const tabProps = { campaign, personas, topics, promptGaps, searchTerms, campaignCreators, activityLog };

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
              {campaign.geo_targets && (
                <span className="text-xs text-gray-500">{(campaign.geo_targets as unknown as string[]).join(' Â· ')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Owner: {campaign.owner_name}</span>
            {campaign.collaborator_name && <span>Â· {campaign.collaborator_name}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); router.replace(`/campaigns/${campaign.id}?tab=${tab.id}`, { scroll: false }); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.id === 'search-terms' && (searchTerms as unknown[]).length > 0 && (
                <span className="ml-1.5 badge bg-gray-100 text-gray-600 border-gray-200 text-xs">
                  {(searchTerms as unknown[]).length}
                </span>
              )}
              {tab.id === 'scoring' && (campaignCreators as { scoring_status: string }[]).filter(cc => cc.scoring_status === 'scored').length > 0 && (
                <span className="ml-1.5 badge bg-purple-100 text-purple-700 border-purple-200 text-xs">
                  {(campaignCreators as { scoring_status: string }[]).filter(cc => cc.scoring_status === 'scored').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab {...tabProps} />}
          {activeTab === 'brief-inputs' && <BriefInputsTab {...tabProps} />}
          {activeTab === 'search-terms' && <SearchTermsTab {...tabProps} />}
          {activeTab === 'discovery' && <DiscoveryTab {...tabProps} />}
          {activeTab === 'ingestion' && <IngestionTab {...tabProps} />}
          {activeTab === 'scoring' && <ScoringTab {...tabProps} />}
          {activeTab === 'review' && <ReviewTab {...tabProps} />}
          {activeTab === 'outreach' && <OutreachTab {...tabProps} />}
          {activeTab === 'reddit' && <RedditTab {...tabProps} />}
          {activeTab === 'activity' && <ActivityTab {...tabProps} />}
        </div>
      </div>
    </div>
  );
}
