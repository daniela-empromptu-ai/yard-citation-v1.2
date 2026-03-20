'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stageLabel } from '@/lib/utils';
import SetupTab from './SetupTab';
import SearchTermsTab from './SearchTermsTab';
import DiscoveryTab from './DiscoveryTab';
import CreatorsTab from './CreatorsTab';

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
  const mapTab = (t: string) => t === 'creators' ? 'engage' : t === 'activity' ? 'setup' : t;
  const [activeTab, setActiveTab] = useState(mapTab(initialTab || 'setup'));
  const [liveSearchTerms, setLiveSearchTerms] = useState(searchTerms);
  const [justStartedPipeline, setJustStartedPipeline] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setLiveSearchTerms(searchTerms);
  }, [searchTerms]);

  const pipelineRunning = pipelineJob?.status === 'queued' || pipelineJob?.status === 'running';
  const pipelineCompleted = pipelineJob?.status === 'completed';
  const pipelineRan = pipelineJob != null;
  const hasScoredCreators = campaignCreators.some(cc => cc.overall_score != null);

  // Clear justStartedPipeline once server data catches up
  useEffect(() => {
    if (pipelineRunning && justStartedPipeline) {
      setJustStartedPipeline(false);
    }
  }, [pipelineRunning, justStartedPipeline]);

  const TABS = [
    { id: 'setup', label: 'Setup', show: true },
    { id: 'search-terms', label: 'Search Terms', show: true, count: liveSearchTerms.length },
    { id: 'discovery', label: 'Discovery', show: pipelineRunning || justStartedPipeline || pipelineCompleted },
    { id: 'engage', label: 'Engage', show: hasScoredCreators || (pipelineCompleted && !pipelineRunning) },
  ];

  const visibleTabs = TABS.filter(t => t.show);

  const handlePipelineStarted = () => {
    setJustStartedPipeline(true);
    setActiveTab('discovery');
    router.replace(`/campaigns/${campaign.id}/discovery`, { scroll: false });
    router.refresh();
  };

  const handleDiscoveryComplete = () => {
    setActiveTab('engage');
    router.replace(`/campaigns/${campaign.id}/engage`, { scroll: false });
    router.refresh();
  };

  const tabProps = { campaign, topics, searchTerms: liveSearchTerms, campaignCreators, activityLog };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-[#2d3748]">
      {/* Campaign header */}
      <div className="px-8 pt-6 pb-0 bg-[#1e293b]">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/campaigns" className="text-xs text-slate-400 hover:text-white transition-colors">Campaigns</Link>
              <span className="text-xs text-slate-600">/</span>
              <span className="text-xs text-slate-300">{campaign.client_name}</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{campaign.name}</h1>
            <div className="flex items-center gap-2.5 mt-2">
              <span className={`badge text-xs ${campaign.status === 'active' ? 'bg-green-900/30 text-green-400 border-green-700/50' : 'bg-slate-800/50 text-slate-400 border-slate-600/50'}`}>
                {campaign.status}
              </span>
              {pipelineRunning && (
                <span className="badge text-xs bg-blue-900/30 text-blue-400 border-blue-700/50 animate-pulse">
                  Generating...
                </span>
              )}
              {campaign.geo_targets && (
                <span className="text-xs text-slate-400">{(campaign.geo_targets as unknown as string[]).join(' \u00B7 ')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Owner: <span className="text-slate-200">{campaign.owner_name}</span></span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 overflow-x-auto border-b border-[#2d3748]">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); router.replace(`/campaigns/${campaign.id}/${tab.id}`, { scroll: false }); }}
              className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 badge bg-slate-800/50 text-slate-400 border-slate-600/50 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-[#111827]">
        <div className="p-6 pt-5">
          {activeTab === 'setup' && <SetupTab {...tabProps} />}
          {activeTab === 'search-terms' && (
            <SearchTermsTab
              {...tabProps}
              pipelineRan={pipelineRan}
              onPipelineStarted={handlePipelineStarted}
              onTermsUpdated={(t) => setLiveSearchTerms(t as typeof searchTerms)}
            />
          )}
          {activeTab === 'discovery' && (
            <DiscoveryTab
              campaign={campaign}
              pipelineJob={pipelineJob}
              onComplete={handleDiscoveryComplete}
            />
          )}
          {activeTab === 'engage' && <CreatorsTab {...tabProps} pipelineJob={pipelineJob} />}
        </div>
      </div>
    </div>
  );
}
