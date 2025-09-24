import { format, subDays, parseISO } from 'date-fns';
import { 
  GSCMetric, 
  AhrefsMetric, 
  NormalizedMetric, 
  ChartDataPoint, 
  TableRow,
  DateRange,
  FilterOptions,
  SOURCES 
} from './types';

/**
 * Normalize Google Search Console data to common format
 */
export function normalizeGSCData(gscData: GSCMetric[]): NormalizedMetric[] {
  return gscData.map(item => ({
    date: item.date,
    source: SOURCES.GSC,
    query: item.query || '',
    url: item.page,
    clicks: item.clicks,
    impressions: item.impressions,
    ctr: item.ctr,
    position: item.position,
    volume: undefined,
    difficulty: undefined,
    cpc: undefined,
    traffic: undefined,
  }));
}

/**
 * Normalize Ahrefs data to common format
 */
export function normalizeAhrefsData(ahrefsData: AhrefsMetric[]): NormalizedMetric[] {
  return ahrefsData.map(item => ({
    date: item.date,
    source: SOURCES.AHREFS,
    query: item.keyword,
    url: item.url,
    clicks: undefined,
    impressions: undefined,
    ctr: undefined,
    position: item.position,
    volume: item.volume,
    difficulty: item.difficulty,
    cpc: item.cpc,
    traffic: item.traffic,
  }));
}

/**
 * Filter normalized data based on filter options
 */
export function filterData(data: NormalizedMetric[], filters: FilterOptions): NormalizedMetric[] {
  return data.filter(item => {
    // Date range filter
    const itemDate = parseISO(item.date);
    const startDate = parseISO(filters.dateRange.startDate);
    const endDate = parseISO(filters.dateRange.endDate);
    
    if (itemDate < startDate || itemDate > endDate) {
      return false;
    }

    // Source filter
    if (!filters.sources.includes(item.source)) {
      return false;
    }

    // Query filter
    if (filters.queries && filters.queries.length > 0) {
      if (!filters.queries.some(query => 
        item.query.toLowerCase().includes(query.toLowerCase())
      )) {
        return false;
      }
    }

    // URL filter
    if (filters.urls && filters.urls.length > 0 && item.url) {
      if (!filters.urls.some(url => 
        item.url!.toLowerCase().includes(url.toLowerCase())
      )) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Convert normalized data to chart data points
 */
export function prepareChartData(
  data: NormalizedMetric[], 
  metric: string,
  groupBy: 'date' | 'query' | 'source' = 'date'
): ChartDataPoint[] {
  const grouped = new Map<string, { value: number; count: number; source?: string }>();

  data.forEach(item => {
    let key: string;
    let value: number | undefined;

    // Determine grouping key
    switch (groupBy) {
      case 'date':
        key = item.date;
        break;
      case 'query':
        key = item.query;
        break;
      case 'source':
        key = item.source;
        break;
      default:
        key = item.date;
    }

    // Get metric value
    switch (metric) {
      case 'clicks':
        value = item.clicks;
        break;
      case 'impressions':
        value = item.impressions;
        break;
      case 'ctr':
        value = item.ctr;
        break;
      case 'position':
        value = item.position;
        break;
      case 'volume':
        value = item.volume;
        break;
      case 'traffic':
        value = item.traffic;
        break;
      default:
        value = 0;
    }

    if (value !== undefined && value !== null) {
      const existing = grouped.get(key) || { value: 0, count: 0 };
      
      // For position, we want average; for others, we want sum
      if (metric === 'position' || metric === 'ctr') {
        existing.value = (existing.value * existing.count + value) / (existing.count + 1);
      } else {
        existing.value += value;
      }
      
      existing.count += 1;
      existing.source = item.source;
      grouped.set(key, existing);
    }
  });

  return Array.from(grouped.entries()).map(([key, { value, source }]) => ({
    date: key,
    value: Math.round(value * 100) / 100, // Round to 2 decimal places
    metric,
    source,
  })).sort((a, b) => {
    // Sort by date if grouping by date
    if (groupBy === 'date') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    // Sort by value for other groupings
    return b.value - a.value;
  });
}

/**
 * Convert normalized data to table rows
 */
export function prepareTableData(data: NormalizedMetric[]): TableRow[] {
  const grouped = new Map<string, {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    volume: number;
    url?: string;
    source: string;
    count: number;
  }>();

  data.forEach(item => {
    const key = item.query;
    const existing = grouped.get(key) || {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      volume: 0,
      url: item.url,
      source: item.source,
      count: 0,
    };

    // Aggregate metrics
    existing.clicks += item.clicks || 0;
    existing.impressions += item.impressions || 0;
    existing.volume += item.volume || 0;
    
    // Average for CTR and position
    existing.ctr = (existing.ctr * existing.count + (item.ctr || 0)) / (existing.count + 1);
    existing.position = (existing.position * existing.count + item.position) / (existing.count + 1);
    
    existing.count += 1;
    grouped.set(key, existing);
  });

  return Array.from(grouped.entries()).map(([query, data]) => ({
    query,
    url: data.url,
    clicks: data.clicks || undefined,
    impressions: data.impressions || undefined,
    ctr: Math.round(data.ctr * 10000) / 100, // Convert to percentage
    position: Math.round(data.position * 10) / 10,
    volume: data.volume || undefined,
    source: data.source,
    change: undefined, // TODO: Calculate change from previous period
  })).sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
}

/**
 * Generate date range presets
 */
export function getDateRangePreset(preset: string): DateRange {
  const today = new Date();
  const endDate = format(today, 'yyyy-MM-dd');
  
  switch (preset) {
    case 'last_7_days':
      return {
        startDate: format(subDays(today, 7), 'yyyy-MM-dd'),
        endDate,
      };
    case 'last_30_days':
      return {
        startDate: format(subDays(today, 30), 'yyyy-MM-dd'),
        endDate,
      };
    case 'last_90_days':
      return {
        startDate: format(subDays(today, 90), 'yyyy-MM-dd'),
        endDate,
      };
    default:
      return {
        startDate: format(subDays(today, 30), 'yyyy-MM-dd'),
        endDate,
      };
  }
}

/**
 * Generate comparison date range based on primary date range
 */
export function getComparisonDateRange(
  primaryRange: { startDate: string; endDate: string },
  comparisonType: 'previous_period' | 'previous_year' = 'previous_period'
): { startDate: string; endDate: string } {
  const primaryStart = new Date(primaryRange.startDate);
  const primaryEnd = new Date(primaryRange.endDate);
  const daysDiff = Math.ceil((primaryEnd.getTime() - primaryStart.getTime()) / (1000 * 60 * 60 * 24));

  if (comparisonType === 'previous_year') {
    // Compare to same period last year
    const comparisonStart = new Date(primaryStart);
    comparisonStart.setFullYear(comparisonStart.getFullYear() - 1);
    
    const comparisonEnd = new Date(primaryEnd);
    comparisonEnd.setFullYear(comparisonEnd.getFullYear() - 1);
    
    return {
      startDate: comparisonStart.toISOString().split('T')[0],
      endDate: comparisonEnd.toISOString().split('T')[0],
    };
  } else {
    // Compare to previous period of same length
    const comparisonEnd = new Date(primaryStart.getTime() - 24 * 60 * 60 * 1000); // Day before primary start
    const comparisonStart = new Date(comparisonEnd.getTime() - (daysDiff - 1) * 24 * 60 * 60 * 1000);
    
    return {
      startDate: comparisonStart.toISOString().split('T')[0],
      endDate: comparisonEnd.toISOString().split('T')[0],
    };
  }
}

/**
 * Extract unique values from data for filter options
 */
export function extractFilterOptions(data: NormalizedMetric[]) {
  const queries = Array.from(new Set(data.map(item => item.query).filter(Boolean))) as string[];
  const urls = Array.from(new Set(data.map(item => item.url).filter(Boolean))) as string[];
  const sources = Array.from(new Set(data.map(item => item.source)));

  return {
    queries: queries.sort(),
    urls: urls.sort(),
    sources,
  };
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data: TableRow[]): string {
  const headers = ['Query', 'URL', 'Clicks', 'Impressions', 'CTR (%)', 'Position', 'Volume', 'Source'];
  const rows = data.map(row => [
    row.query,
    row.url || '',
    row.clicks || 0,
    row.impressions || 0,
    row.ctr || 0,
    row.position,
    row.volume || 0,
    row.source,
  ]);

  return [headers, ...rows].map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
}

/**
 * Calculate percentage change between two values
 */
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Format metric values for display
 */
export function formatMetricValue(value: number, metric: string): string {
  switch (metric) {
    case 'ctr':
      return `${value.toFixed(2)}%`;
    case 'position':
      return value.toFixed(1);
    case 'clicks':
    case 'impressions':
    case 'volume':
    case 'traffic':
      return value.toLocaleString();
    case 'cpc':
      return `$${value.toFixed(2)}`;
    default:
      return value.toString();
  }
}
