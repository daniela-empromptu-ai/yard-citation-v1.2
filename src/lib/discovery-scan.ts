/**
 * Topic matching + ranking for creator discovery.
 * Matches grouped creators against campaign topics using substring containment.
 */

import { GroupedCreator } from './google-sheets';

export interface MatchedCreator extends GroupedCreator {
  matchScore: number;
  matchedTopics: string[];
}

/**
 * Match creators to campaign topics using case-insensitive substring containment.
 * A campaign topic "Kubernetes" matches a creator topic "Kubernetes cost optimization".
 *
 * Returns top N creators sorted by matchScore desc, then total_followers desc.
 * Excludes creators with 0 matches.
 */
export function matchCreatorsToTopics(
  creators: GroupedCreator[],
  campaignTopics: string[],
  topN: number = 100
): MatchedCreator[] {
  if (campaignTopics.length === 0) return [];

  const campaignTopicsLower = campaignTopics.map(t => t.toLowerCase().trim());

  const scored: MatchedCreator[] = [];

  for (const creator of creators) {
    const creatorTopicsLower = creator.primary_topics.map(t => t.toLowerCase());
    const matchedCampaignTopics = new Set<string>();

    for (const ct of campaignTopicsLower) {
      for (const creatorTopic of creatorTopicsLower) {
        // Substring containment in either direction:
        // "Kubernetes" matches "Kubernetes cost optimization"
        // "DevOps automation" matches "DevOps"
        if (creatorTopic.includes(ct) || ct.includes(creatorTopic)) {
          matchedCampaignTopics.add(ct);
          break;
        }
      }
    }

    if (matchedCampaignTopics.size > 0) {
      scored.push({
        ...creator,
        matchScore: matchedCampaignTopics.size,
        matchedTopics: Array.from(matchedCampaignTopics),
      });
    }
  }

  // Sort: highest matchScore first, then highest followers as tiebreaker
  scored.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return b.total_followers - a.total_followers;
  });

  return scored.slice(0, topN);
}
