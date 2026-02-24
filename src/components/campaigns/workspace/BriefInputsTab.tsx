'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/components/ui/Toast';

interface Props {
  campaign: { id: string; creative_brief: string; product_category: string };
  personas: { id: string; persona_name: string }[];
  topics: { id: string; topic: string; source: string; confidence: number | null; rationale: string | null; approved: boolean }[];
  promptGaps: { id: string; prompt_text: string; priority: string; persona: string | null; status: string }[];
  [key: string]: unknown;
}

export default function BriefInputsTab({ campaign, personas, topics, promptGaps }: Props) {
  const [showMd, setShowMd] = useState(true);
  const { addToast } = useToast();

  return (
    <div className="space-y-6">
      {/* Creative Brief */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Creative Brief</h3>
          <button onClick={() => setShowMd(!showMd)} className="btn-ghost text-xs">
            {showMd ? 'View Raw' : 'View Formatted'}
          </button>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto">
          {showMd ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{campaign.creative_brief || '_No brief provided_'}</ReactMarkdown>
            </div>
          ) : (
            <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">{campaign.creative_brief || 'No brief provided'}</pre>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Personas */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Target Personas</h3>
          {personas.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No personas defined.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {personas.map(p => (
                <div key={p.id} className="badge bg-purple-50 text-purple-700 border-purple-200 text-sm px-3 py-1">
                  {p.persona_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topics */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Campaign Topics</h3>
          {topics.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No topics defined.</p>
          ) : (
            <div className="space-y-2">
              {topics.map(tp => (
                <div key={tp.id} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tp.approved ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm text-gray-800 flex-1">{tp.topic}</span>
                  {tp.source === 'ai_suggested' && (
                    <span className="badge bg-blue-50 text-blue-600 border-blue-200 text-xs">AI</span>
                  )}
                  {tp.confidence && (
                    <span className="text-xs text-gray-400">{Math.round(tp.confidence * 100)}%</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prompt Gaps */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Prompt Gaps</h3>
          <span className="text-xs text-gray-500">{promptGaps.length} gaps</span>
        </div>
        {promptGaps.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No prompt gaps defined.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Prompt / Question</th>
                  <th>Priority</th>
                  <th>Persona</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {promptGaps.map(gap => (
                  <tr key={gap.id}>
                    <td className="font-medium text-gray-800 max-w-lg">{gap.prompt_text}</td>
                    <td>
                      <span className={`badge text-xs ${
                        gap.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                        gap.priority === 'medium' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>{gap.priority}</span>
                    </td>
                    <td className="text-gray-600 text-xs">{gap.persona || 'â'}</td>
                    <td>
                      <span className={`badge text-xs ${
                        gap.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>{gap.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
