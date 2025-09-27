import { NormalizedMetric } from './types';
import { IReportingData } from './models/gsc-data';

/**
 * Convert NormalizedMetric array to MongoDB format (works for both GSC and Ahrefs)
 */
export function normalizedMetricsToMongoDB(
  metrics: NormalizedMetric[],
  importId: string,
  siteUrl?: string
): Partial<IReportingData>[] {
  return metrics.map(metric => ({
    // Import metadata
    importId,
    siteUrl,
    importedAt: new Date(),
    
    // GSC data fields
    date: metric.date,
    query: metric.query,
    url: metric.url,
    page: metric.url, // Use url as page for consistency
    
    // Metrics - reconstruct based on source and metric type
    clicks: metric.metric_type === 'clicks' ? metric.value : undefined,
    impressions: metric.metric_type === 'impressions' ? metric.value : undefined,
    ctr: metric.metric_type === 'ctr' ? metric.value : undefined,
    position: metric.metric_type === 'position' ? metric.value : undefined,
    volume: metric.metric_type === 'volume' ? metric.value : undefined,
    traffic: metric.metric_type === 'traffic' ? metric.value : undefined,
    
    // Normalized fields (keep existing structure)
    source: metric.source,
    metric_type: metric.metric_type,
    value: metric.value,
    
    // Additional metadata
    dimensions: [], // Will be filled by the import process
    isTimeSeries: !metric.query && !metric.url // Time series if no query/url
  }));
}

/**
 * Convert MongoDB data back to NormalizedMetric format (works for both GSC and Ahrefs)
 */
export function mongoDBToNormalizedMetrics(reportingData: IReportingData[]): NormalizedMetric[] {
  // Group by unique record (date + query + url combination)
  const groupedData = new Map<string, any>();
  
  for (const data of reportingData) {
    const key = `${data.date}-${data.query || 'total'}-${data.url || 'all'}-${data.source}`;
    
    if (!groupedData.has(key)) {
      groupedData.set(key, {
        date: data.date,
        source: data.source,
        query: data.query,
        url: data.url,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        volume: 0,
        traffic: 0
      });
    }
    
    const record = groupedData.get(key);
    
    // Set the metric value based on metric_type
    switch (data.metric_type) {
      case 'clicks':
        record.clicks = data.value;
        break;
      case 'impressions':
        record.impressions = data.value;
        break;
      case 'ctr':
        record.ctr = data.value;
        break;
      case 'position':
        record.position = data.value;
        break;
      case 'volume':
        record.volume = data.value;
        break;
      case 'traffic':
        record.traffic = data.value;
        break;
    }
  }
  
  // Convert to the format your frontend expects (with separate metric fields)
  const normalizedMetrics: NormalizedMetric[] = [];
  
  for (const record of groupedData.values()) {
    // Create separate NormalizedMetric entries for each metric type that has a value
    const metricTypes = record.source === 'gsc' 
      ? [
          { type: 'clicks', value: record.clicks },
          { type: 'impressions', value: record.impressions },
          { type: 'ctr', value: record.ctr },
          { type: 'position', value: record.position }
        ]
      : [
          { type: 'volume', value: record.volume },
          { type: 'traffic', value: record.traffic }
        ];
    
    for (const metric of metricTypes) {
      if (metric.value !== undefined) {
        normalizedMetrics.push({
          date: record.date,
          source: record.source,
          query: record.query,
          url: record.url,
          metric_type: metric.type as any,
          value: metric.value,
          // Include the original GSC fields for compatibility
          clicks: record.clicks,
          impressions: record.impressions,
          ctr: record.ctr,
          position: record.position,
          volume: record.volume,
          traffic: record.traffic
        } as any);
      }
    }
  }
  
  return normalizedMetrics;
}

/**
 * Group GSC raw data by record and convert to MongoDB format
 * This handles the case where one GSC record becomes multiple normalized metrics
 */
export function gscRawDataToMongoDB(
  rawData: any[],
  importId: string,
  siteUrl: string,
  dimensions: string[],
  isTimeSeries: boolean = false
): Partial<IReportingData>[] {
  const mongoData: Partial<IReportingData>[] = [];
  
  for (const record of rawData) {
    // Create one MongoDB document per GSC record with all metrics
    const baseDoc: Partial<IReportingData> = {
      importId,
      siteUrl,
      importedAt: new Date(),
      date: record.date,
      query: record.query,
      url: record.page,
      page: record.page,
      country: record.country,
      device: record.device,
      clicks: record.clicks || 0,
      impressions: record.impressions || 0,
      ctr: record.ctr || 0,
      position: record.position || 0,
      source: 'gsc',
      dimensions,
      isTimeSeries
    };
    
    // Create separate documents for each metric type (to match your current structure)
    const metricTypes: Array<{ type: 'clicks' | 'impressions' | 'ctr' | 'position', value: number }> = [
      { type: 'clicks', value: record.clicks || 0 },
      { type: 'impressions', value: record.impressions || 0 },
      { type: 'ctr', value: record.ctr || 0 },
      { type: 'position', value: record.position || 0 }
    ];
    
    for (const metric of metricTypes) {
      mongoData.push({
        ...baseDoc,
        metric_type: metric.type,
        value: metric.value
      });
    }
  }
  
  return mongoData;
}

// Legacy function - use the new generateImportId instead
export function generateGSCImportId(siteUrl: string, startDate: string, endDate: string): string {
  return generateImportId('gsc', siteUrl, startDate, endDate);
}

/**
 * Build MongoDB query from filters
 */
export function buildMongoQuery(filters: {
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
  query?: string;
  page?: string;
  source?: string;
  metricTypes?: string[];
  importId?: string;
}) {
  const query: any = {};
  
  if (filters.siteUrl) query.siteUrl = filters.siteUrl;
  if (filters.importId) query.importId = filters.importId;
  if (filters.source) query.source = filters.source;
  
  if (filters.startDate || filters.endDate) {
    query.date = {};
    if (filters.startDate) query.date.$gte = filters.startDate;
    if (filters.endDate) query.date.$lte = filters.endDate;
  }
  
  if (filters.query) {
    query.query = { $regex: filters.query, $options: 'i' };
  }
  
  if (filters.page) {
    query.page = { $regex: filters.page, $options: 'i' };
  }
  
  if (filters.metricTypes && filters.metricTypes.length > 0) {
    query.metric_type = { $in: filters.metricTypes };
  }
  
  return query;
}

/**
 * Convert Ahrefs CSV data to MongoDB format
 */
export function ahrefsDataToMongoDB(
  ahrefsData: any[],
  importId: string,
  fileName: string
): Partial<IReportingData>[] {
  const mongoData: Partial<IReportingData>[] = [];
  
  for (const record of ahrefsData) {
    // Create one MongoDB document per Ahrefs record with all metrics and comparison data
    const baseDoc: Partial<IReportingData> = {
      importId,
      importedAt: new Date(),
      date: record.date || '', // Current date
      query: record.query || record.keyword,
      url: record.url,
      page: record.url,
      source: 'ahrefs',
      dimensions: ['query', 'url'],
      isTimeSeries: false,
      // Store all Ahrefs data in a single document to preserve relationships
      volume: record.volume || 0,
      traffic: record.traffic || 0,
      position: record.position || 0,
      difficulty: record.difficulty || 0,
      cpc: record.cpc || 0,
      serpFeatures: record.serpFeatures || '',
      // Comparison fields
      previousTraffic: record.previousTraffic || 0,
      previousPosition: record.previousPosition || 0,
      previousDate: record.previousDate || '',
      trafficChange: record.trafficChange || 0,
      positionChange: record.positionChange || 0
    };
    
    // Store as a single document with all data
    mongoData.push(baseDoc);
  }
  
  return mongoData;
}

/**
 * Clear existing data for a source before importing new data
 */
export async function clearExistingData(source: 'gsc' | 'ahrefs', siteUrl?: string) {
  const { ReportingData } = await import('./models/gsc-data');
  
  const query: any = { source };
  if (siteUrl && source === 'gsc') {
    query.siteUrl = siteUrl;
  }
  
  const deleteResult = await ReportingData.deleteMany(query);
  
  console.log(`🗑️ Cleared existing ${source.toUpperCase()} data:`, {
    deletedCount: deleteResult.deletedCount,
    source,
    siteUrl: siteUrl || 'all'
  });
  
  return deleteResult.deletedCount;
}

/**
 * Generate unique import ID for any source
 */
export function generateImportId(source: 'gsc' | 'ahrefs', identifier: string, startDate?: string, endDate?: string): string {
  const cleanIdentifier = identifier.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = Date.now();
  
  if (startDate && endDate) {
    const start = startDate.replace(/-/g, '');
    const end = endDate.replace(/-/g, '');
    return `${source}_${cleanIdentifier}_${start}_${end}_${timestamp}`;
  }
  
  return `${source}_${cleanIdentifier}_${timestamp}`;
}
