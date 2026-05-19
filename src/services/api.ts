import { IssueRecord, RawIssue } from '../types';
import { transformIssues } from '../utils/transform';
import { mockIssues } from './mockData';

export type FetchProgress = {
  fetched: number;
  page: number;
  hasMore: boolean;
  lastPageCount: number;
  avgMsPerPage: number;
};

export async function fetchCycleTimeData(
  onProgress?: (p: FetchProgress) => void
): Promise<{ data: IssueRecord[]; source: 'api' | 'mock'; error?: string }> {
  try {
    const allRecords: RawIssue[] = [];
    let nextPageToken: string | null = null;
    let safetyCounter = 0;
    const pageTimes: number[] = [];
    let pageStart = Date.now();

    do {
      const url = nextPageToken
        ? `/api/timepiece/cycle-time?nextPageToken=${encodeURIComponent(nextPageToken)}`
        : '/api/timepiece/cycle-time';

      const response = await fetch(url);
      let json: Record<string, unknown>;
      try {
        json = await response.json();
      } catch {
        throw new Error(`Server returned an invalid response (HTTP ${response.status}). The function may have timed out — check Netlify function logs.`);
      }
      if (!response.ok) throw new Error((json.error as string) || `HTTP ${response.status}`);

      const pageRecords = Array.isArray(json.records) ? (json.records as RawIssue[]) : [];
      allRecords.push(...pageRecords);
      nextPageToken = (json.nextPageToken as string | null) || null;
      safetyCounter++;

      const elapsed = Date.now() - pageStart;
      pageTimes.push(elapsed);
      pageStart = Date.now();
      const avgMsPerPage = pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length;

      onProgress?.({
        fetched: allRecords.length,
        page: safetyCounter,
        hasMore: !!nextPageToken,
        lastPageCount: pageRecords.length,
        avgMsPerPage,
      });
    } while (nextPageToken && safetyCounter < 250);

    return { data: transformIssues(allRecords), source: 'api' };
  } catch (error) {
    return {
      data: transformIssues(mockIssues),
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown API error'
    };
  }
}
