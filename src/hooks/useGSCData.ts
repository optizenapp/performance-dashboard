import { useState, useEffect, useCallback, useMemo } from 'react';
import { NormalizedMetric } from '@/lib/types';
import { normalizeGSCData } from '@/lib/data-utils';

interface UseGSCDataProps {
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
  dimensions?: string[];
  timeSeries?: boolean;
  enabled?: boolean;
  quickView?: boolean; // For summary stats, use no dimensions (fastest)
  hookId?: string; // For debugging multiple hook instances
}

interface GSCDataResult {
  data: NormalizedMetric[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGSCData({
  siteUrl,
  startDate,
  endDate,
  dimensions = ['query', 'page'],
  timeSeries = false,
  enabled = true,
  quickView = false,
  hookId = 'unknown'
}: UseGSCDataProps): GSCDataResult {
  const [data, setData] = useState<NormalizedMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize dimensions array to prevent infinite re-renders
  const stableDimensions = useMemo(() => dimensions, [JSON.stringify(dimensions)]);

  const fetchData = useCallback(async () => {
    console.log(`🔍 useGSCData fetchData called [${hookId}]:`, {
      enabled,
      siteUrl,
      startDate,
      endDate,
      quickView,
      willProceed: !!(enabled && siteUrl && startDate && endDate)
    });
    
    if (!enabled || !siteUrl || !startDate || !endDate) {
      console.log('❌ useGSCData: Skipping fetch - missing requirements');
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For Quick View, use no dimensions for fastest aggregated results
      const finalDimensions = quickView ? [] : stableDimensions;
      
      console.log('🔄 Fetching GSC data on-demand:', { 
        siteUrl, 
        startDate, 
        endDate, 
        dimensions: finalDimensions, 
        timeSeries,
        quickView,
        strategy: quickView ? 'FAST: Aggregated totals only' : 'DETAILED: With dimensions'
      });

      const response = await fetch('/api/gsc/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          startDate,
          endDate,
          dimensions: finalDimensions,
          timeSeries
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch GSC data');
      }

      // Normalize the GSC data to our common format
      const normalizedData = normalizeGSCData(result.data);

      console.log('✅ GSC data fetched successfully:', {
        rawCount: result.data?.length || 0,
        normalizedCount: normalizedData.length,
        dateRange: { startDate, endDate },
        sampleData: normalizedData.slice(0, 3)
      });

      setData(normalizedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Failed to fetch GSC data:', errorMessage);
      setError(errorMessage);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [siteUrl, startDate, endDate, stableDimensions, timeSeries, enabled, quickView]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
