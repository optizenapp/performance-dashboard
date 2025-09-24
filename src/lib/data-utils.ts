import { format, subDays, subMonths, subYears, parseISO } from 'date-fns';
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
    position: item.position, // Average position from GSC
    volume: undefined,
    difficulty: undefined,
    cpc: undefined,
    traffic: undefined,
    serpFeatures: undefined, // GSC doesn't have SERP features data
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
    position: item.position, // Use Ahrefs position data
    volume: item.volume,
    difficulty: item.difficulty,
    cpc: item.cpc,
    traffic: item.traffic,
    serpFeatures: item.serpFeatures,
    // Comparison fields for Ahrefs
    previousTraffic: item.previousTraffic,
    trafficChange: item.trafficChange,
    previousPosition: item.previousPosition,
    positionChange: item.positionChange,
    previousDate: item.previousDate,
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
export function prepareTableData(data: NormalizedMetric[], enableComparison = false): TableRow[] {
  if (data.length === 0) return [];

  // Group data by query and URL
  const grouped = new Map<string, NormalizedMetric[]>();
  
  data.forEach(item => {
    // Group by query, URL, and SERP features to preserve different positions for different SERP features
    const key = `${item.query}|${item.url || 'no-url'}|${item.serpFeatures || 'no-serp'}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  });

  return Array.from(grouped.entries()).map(([key, items]) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [query, urlPart, serpPart] = key.split('|');
    const url = items[0].url || undefined;
    const serpFeatures = serpPart !== 'no-serp' ? serpPart : undefined;
    
    // Get sources for this query-URL combination
    const sources = new Set(items.map(item => item.source));
    let sourceDisplay = '';
    if (sources.size > 1) {
      sourceDisplay = 'Both';
    } else if (sources.has('gsc')) {
      sourceDisplay = 'GSC';
    } else if (sources.has('ahrefs')) {
      sourceDisplay = 'Ahrefs';
    }

    if (enableComparison) {
      // For comparison mode: show earliest vs latest data
      const sortedByDate = items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const earliest = sortedByDate[0];
      const latest = sortedByDate[sortedByDate.length - 1];
      
      // Separate GSC and Ahrefs data for proper calculations
      const gscItems = items.filter(item => item.source === 'gsc').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const ahrefsItems = items.filter(item => item.source === 'ahrefs').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // GSC data (first and last dates)
      const gscFirst = gscItems[0];
      const gscLast = gscItems[gscItems.length - 1];
      
      // Ahrefs data (use comparison data from CSV or first/last if comparison data exists)
      const ahrefsFirst = ahrefsItems[0];
      const ahrefsLast = ahrefsItems[ahrefsItems.length - 1];
      
      // Calculate percentage changes for GSC metrics
      const clicksChange = gscFirst?.clicks && gscLast?.clicks ? 
        Math.round(((gscLast.clicks - gscFirst.clicks) / gscFirst.clicks) * 100) : undefined;
      const impressionsChange = gscFirst?.impressions && gscLast?.impressions ? 
        Math.round(((gscLast.impressions - gscFirst.impressions) / gscFirst.impressions) * 100) : undefined;
      const ctrChange = gscFirst?.ctr && gscLast?.ctr ? 
        Math.round(((gscLast.ctr - gscFirst.ctr) / gscFirst.ctr) * 100) : undefined;
      
      // Calculate raw changes for GSC metrics
      const clicksChangeValue = gscFirst?.clicks && gscLast?.clicks ? 
        gscLast.clicks - gscFirst.clicks : undefined;
      const impressionsChangeValue = gscFirst?.impressions && gscLast?.impressions ? 
        gscLast.impressions - gscFirst.impressions : undefined;
      const ctrChangeValue = gscFirst?.ctr && gscLast?.ctr ? 
        gscLast.ctr - gscFirst.ctr : undefined;
      
      // For Ahrefs, use comparison data from CSV if available, otherwise calculate
      const ahrefsItem = ahrefsItems[0]; // Get any Ahrefs item for comparison data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ahrefsItemAny = ahrefsItem as any;
      
      // Position changes (Ahrefs) - use CSV comparison data if available
      const positionFirst = ahrefsItemAny?.previousPosition || ahrefsFirst?.position;
      const positionLast = ahrefsItemAny?.position || ahrefsLast?.position; // Current position
      const positionChangeValue = ahrefsItemAny?.positionChange || 
        (positionFirst && positionLast ? positionLast - positionFirst : undefined);
      const positionChange = positionFirst && positionLast ? 
        Math.round(((positionLast - positionFirst) / positionFirst) * 100) : undefined;
      
      // Traffic changes (Ahrefs) - use CSV comparison data if available
      const trafficFirst = ahrefsItemAny?.previousTraffic || ahrefsFirst?.traffic;
      const trafficLast = ahrefsItemAny?.traffic || ahrefsLast?.traffic; // Current traffic
      const trafficChangeValue = ahrefsItemAny?.trafficChange || 
        (trafficFirst && trafficLast ? trafficLast - trafficFirst : undefined);
      const trafficChange = ahrefsItemAny?.trafficChange; // Use CSV percentage if available
      
      return {
        query,
        url,
        clicks: latest.clicks || undefined,
        impressions: latest.impressions || undefined,
        ctr: latest.ctr ? Math.round(latest.ctr * 10000) / 100 : undefined, // Convert to percentage
        position: latest.position ? Math.round(latest.position * 10) / 10 : undefined,
        volume: latest.volume || undefined,
        source: sourceDisplay,
        serpFeatures,
        change: trafficChange || undefined, // Ahrefs traffic change percentage
        
        // Additional comparison data for the new table structure
        clicksChange,
        impressionsChange,
        ctrChange,
        positionChange,
        
        // First and last date values for each metric
        clicksFirst: gscFirst?.clicks,
        clicksLast: gscLast?.clicks,
        impressionsFirst: gscFirst?.impressions,
        impressionsLast: gscLast?.impressions,
        ctrFirst: gscFirst?.ctr ? Math.round(gscFirst.ctr * 10000) / 100 : undefined,
        ctrLast: gscLast?.ctr ? Math.round(gscLast.ctr * 10000) / 100 : undefined,
        
        positionFirst: positionFirst ? Math.round(positionFirst * 10) / 10 : undefined,
        positionLast: positionLast ? Math.round(positionLast * 10) / 10 : undefined,
        trafficFirst,
        trafficLast,
        
        // Raw change values (not percentages)
        clicksChangeValue,
        impressionsChangeValue,
        ctrChangeValue,
        positionChangeValue,
        trafficChangeValue,
      };
    } else {
      // For non-comparison mode: use most recent data
      const sortedByDate = items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const mostRecent = sortedByDate[0];
      
      return {
        query,
        url,
        clicks: mostRecent.clicks || undefined,
        impressions: mostRecent.impressions || undefined,
        ctr: mostRecent.ctr ? Math.round(mostRecent.ctr * 10000) / 100 : undefined, // Convert to percentage
        position: mostRecent.position ? Math.round(mostRecent.position * 10) / 10 : undefined,
        volume: mostRecent.volume || undefined,
        source: sourceDisplay,
        serpFeatures,
        change: undefined, // No change column in non-comparison mode
      };
    }
  }).sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
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
 * Get date ranges for comparison presets
 */
export function getComparisonPresetRanges(preset: string): {
  primary: { startDate: string; endDate: string };
  comparison: { startDate: string; endDate: string };
} {
  const today = new Date();
  const endDate = format(today, 'yyyy-MM-dd');
  
  switch (preset) {
    case 'last_24h_vs_previous': {
      const primary = {
        startDate: format(subDays(today, 1), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subDays(today, 2), 'yyyy-MM-dd'),
        endDate: format(subDays(today, 1), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
    
    case 'last_24h_vs_week_ago': {
      const primary = {
        startDate: format(subDays(today, 1), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subDays(today, 8), 'yyyy-MM-dd'),
        endDate: format(subDays(today, 7), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
    
    case 'last_7d_vs_previous': {
      const primary = {
        startDate: format(subDays(today, 7), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subDays(today, 14), 'yyyy-MM-dd'),
        endDate: format(subDays(today, 7), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
    
    case 'last_7d_vs_year_ago': {
      const primary = {
        startDate: format(subDays(today, 7), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subDays(subYears(today, 1), 7), 'yyyy-MM-dd'),
        endDate: format(subYears(today, 1), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
    
    case 'last_28d_vs_previous': {
      const primary = {
        startDate: format(subDays(today, 28), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subDays(today, 56), 'yyyy-MM-dd'),
        endDate: format(subDays(today, 28), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
    
    case 'last_28d_vs_year_ago': {
      const primary = {
        startDate: format(subDays(today, 28), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subDays(subYears(today, 1), 28), 'yyyy-MM-dd'),
        endDate: format(subYears(today, 1), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
    
    case 'last_3m_vs_previous': {
      const primary = {
        startDate: format(subMonths(today, 3), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subMonths(today, 6), 'yyyy-MM-dd'),
        endDate: format(subMonths(today, 3), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
    
    case 'last_3m_vs_year_ago': {
      const primary = {
        startDate: format(subMonths(today, 3), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subMonths(subYears(today, 1), 3), 'yyyy-MM-dd'),
        endDate: format(subYears(today, 1), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
    
    case 'last_6m_vs_previous': {
      const primary = {
        startDate: format(subMonths(today, 6), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subMonths(today, 12), 'yyyy-MM-dd'),
        endDate: format(subMonths(today, 6), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
    
    default: {
      // Default to last 28 days vs previous
      const primary = {
        startDate: format(subDays(today, 28), 'yyyy-MM-dd'),
        endDate,
      };
      const comparison = {
        startDate: format(subDays(today, 56), 'yyyy-MM-dd'),
        endDate: format(subDays(today, 28), 'yyyy-MM-dd'),
      };
      return { primary, comparison };
    }
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
