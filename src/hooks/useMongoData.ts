import { useState, useEffect, useCallback } from 'react';
import { NormalizedMetric } from '@/lib/types';

interface UseMongoDataProps {
  startDate?: string;
  endDate?: string;
  source?: string;
  limit?: number;
  enabled?: boolean;
}

interface MongoDataResult {
  data: NormalizedMetric[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMongoData({
  startDate,
  endDate,
  source = 'gsc',
  limit = 10000,
  enabled = true
}: UseMongoDataProps): MongoDataResult {
  const [data, setData] = useState<NormalizedMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled || !startDate || !endDate) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        source,
        limit: limit.toString(),
        startDate,
        endDate
      });

      console.log('🔄 Fetching MongoDB data:', { startDate, endDate, source, limit });

      const response = await fetch(`/api/gsc/data-mongo?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      console.log('✅ MongoDB data fetched:', {
        recordCount: result.data?.length || 0,
        dateRange: { startDate, endDate }
      });

      setData(result.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Failed to fetch MongoDB data:', errorMessage);
      setError(errorMessage);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, source, limit, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

