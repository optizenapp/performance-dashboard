import { z } from 'zod';

// Google Search Console Data Types
export const GSCMetricSchema = z.object({
  date: z.string(),
  query: z.string().optional(),
  page: z.string().optional(),
  country: z.string().optional(),
  device: z.string().optional(),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});

export const GSCResponseSchema = z.object({
  rows: z.array(
    z.object({
      keys: z.array(z.string()).optional(),
      clicks: z.number(),
      impressions: z.number(),
      ctr: z.number(),
      position: z.number(),
    })
  ),
});

// Ahrefs Data Types
export const AhrefsMetricSchema = z.object({
  date: z.string(),
  keyword: z.string(),
  url: z.string().optional(),
  position: z.number().optional(),
  volume: z.number().optional(),
  difficulty: z.number().optional(),
  cpc: z.number().optional(),
  traffic: z.number().optional(),
  serpFeatures: z.string().optional(),
  // Comparison fields
  previousTraffic: z.number().optional(),
  trafficChange: z.number().optional(),
  previousPosition: z.number().optional(),
  positionChange: z.number().optional(),
  previousDate: z.string().optional(),
});

// Ahrefs Comparison CSV Schema (for comparison exports)
export const AhrefsComparisonMetricSchema = z.object({
  keyword: z.string(),
  currentUrl: z.string().optional(),
  previousUrl: z.string().optional(),
  currentPosition: z.number().optional(),
  previousPosition: z.number().optional(),
  positionChange: z.number().optional(),
  currentTraffic: z.number().optional(),
  previousTraffic: z.number().optional(),
  trafficChange: z.number().optional(),
  currentDate: z.string(),
  previousDate: z.string(),
  volume: z.number().optional(),
  difficulty: z.number().optional(),
  cpc: z.number().optional(),
  // Intent classification (optional)
  branded: z.boolean().optional(),
  local: z.boolean().optional(),
  navigational: z.boolean().optional(),
  informational: z.boolean().optional(),
  commercial: z.boolean().optional(),
  transactional: z.boolean().optional(),
});

// Normalized Data Types (combining both sources)
export const NormalizedMetricSchema = z.object({
  date: z.string(),
  source: z.enum(['gsc', 'ahrefs']),
  query: z.string(),
  url: z.string().optional(),
  clicks: z.number().optional(),
  impressions: z.number().optional(),
  ctr: z.number().optional(),
  position: z.number().optional(),
  volume: z.number().optional(),
  difficulty: z.number().optional(),
  cpc: z.number().optional(),
  traffic: z.number().optional(),
  serpFeatures: z.string().optional(),
});

// Filter Types
export const DateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

export const ComparisonPresetSchema = z.enum([
  'last_7d_vs_previous',
  'last_14d_vs_previous',
  'last_30d_vs_previous',
  'last_60d_vs_previous',
  'last_90d_vs_previous',
  'last_120d_vs_previous'
]);

export const FilterOptionsSchema = z.object({
  dateRange: DateRangeSchema,
  comparisonDateRange: DateRangeSchema.optional(),
  enableComparison: z.boolean().optional(),
  comparisonPreset: ComparisonPresetSchema.optional(),
  metrics: z.array(z.enum(['clicks', 'impressions', 'ctr', 'position', 'volume', 'traffic'])),
  sources: z.array(z.enum(['gsc', 'ahrefs'])),
  queries: z.array(z.string()).optional(),
  urls: z.array(z.string()).optional(),
});

export type FilterOptions = z.infer<typeof FilterOptionsSchema>;

// Section-specific filter types
export const SectionFiltersSchema = z.object({
  dateRange: DateRangeSchema,
  enableComparison: z.boolean().optional(),
  comparisonDateRange: DateRangeSchema.optional(),
  comparisonPreset: ComparisonPresetSchema.optional(),
});

export type SectionFilters = z.infer<typeof SectionFiltersSchema>;

// Global filter types (for data fetching)
export const GlobalFiltersSchema = z.object({
  dateRange: DateRangeSchema, // Wide date range to cover all sections
  metrics: z.array(z.enum(['clicks', 'impressions', 'ctr', 'position', 'volume', 'traffic'])),
  sources: z.array(z.enum(['gsc', 'ahrefs'])),
  queries: z.array(z.string()).optional(),
  urls: z.array(z.string()).optional(),
});

export type GlobalFilters = z.infer<typeof GlobalFiltersSchema>;

// Dashboard filter structure
export const DashboardFiltersSchema = z.object({
  global: GlobalFiltersSchema,
  chart: SectionFiltersSchema,
  quickView: SectionFiltersSchema,
  table: SectionFiltersSchema,
});

export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>;

// Chart Data Types
export const ChartDataPointSchema = z.object({
  date: z.string(),
  value: z.number(),
  comparisonValue: z.number().optional(),
  metric: z.string(),
  source: z.string().optional(),
});

export const TableRowSchema = z.object({
  query: z.string(),
  url: z.string().optional(),
  clicks: z.number().optional(),
  impressions: z.number().optional(),
  ctr: z.number().optional(),
  position: z.number().optional(),
  volume: z.number().optional(),
  source: z.string(),
  serpFeatures: z.string().optional(),
  change: z.number().optional(), // traffic change from Ahrefs (only when comparison enabled)
  // Additional comparison fields for potential future use
  clicksChange: z.number().optional(),
  impressionsChange: z.number().optional(),
  ctrChange: z.number().optional(),
  positionChange: z.number().optional(),
});

// Export types
export type GSCMetric = z.infer<typeof GSCMetricSchema>;
export type GSCResponse = z.infer<typeof GSCResponseSchema>;
export type AhrefsMetric = z.infer<typeof AhrefsMetricSchema>;
export type AhrefsComparisonMetric = z.infer<typeof AhrefsComparisonMetricSchema>;
export type NormalizedMetric = z.infer<typeof NormalizedMetricSchema>;
export type ComparisonPreset = z.infer<typeof ComparisonPresetSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type ChartDataPoint = z.infer<typeof ChartDataPointSchema>;
export type TableRow = z.infer<typeof TableRowSchema>;

// Performance Clusters Types
export const PerformanceClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  urls: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PerformanceCluster = z.infer<typeof PerformanceClusterSchema>;

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Component Props Types
export interface DashboardProps {
  initialData?: NormalizedMetric[];
}

export interface ChartProps {
  data: ChartDataPoint[];
  metric: string;
  height?: number;
  showComparison?: boolean;
}

export interface FilterProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableQueries: string[];
  availableUrls: string[];
}

export interface DataTableProps {
  data: TableRow[];
  loading?: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onExport?: (format: 'csv' | 'json') => void;
}

// Constants
export const METRICS = {
  CLICKS: 'clicks',
  IMPRESSIONS: 'impressions',
  CTR: 'ctr',
  POSITION: 'position',
  VOLUME: 'volume',
  TRAFFIC: 'traffic',
} as const;

export const SOURCES = {
  GSC: 'gsc',
  AHREFS: 'ahrefs',
} as const;

export const DATE_PRESETS = {
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  LAST_90_DAYS: 'last_90_days',
  CUSTOM: 'custom',
} as const;
