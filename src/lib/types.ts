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
  position: z.number(),
  volume: z.number().optional(),
  difficulty: z.number().optional(),
  cpc: z.number().optional(),
  traffic: z.number().optional(),
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
  position: z.number(),
  volume: z.number().optional(),
  difficulty: z.number().optional(),
  cpc: z.number().optional(),
  traffic: z.number().optional(),
});

// Filter Types
export const DateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

export const FilterOptionsSchema = z.object({
  dateRange: DateRangeSchema,
  metrics: z.array(z.enum(['clicks', 'impressions', 'ctr', 'position', 'volume', 'traffic'])),
  sources: z.array(z.enum(['gsc', 'ahrefs'])),
  queries: z.array(z.string()).optional(),
  urls: z.array(z.string()).optional(),
});

// Chart Data Types
export const ChartDataPointSchema = z.object({
  date: z.string(),
  value: z.number(),
  metric: z.string(),
  source: z.string().optional(),
});

export const TableRowSchema = z.object({
  query: z.string(),
  url: z.string().optional(),
  clicks: z.number().optional(),
  impressions: z.number().optional(),
  ctr: z.number().optional(),
  position: z.number(),
  volume: z.number().optional(),
  source: z.string(),
  change: z.number().optional(), // percentage change from previous period
});

// Export types
export type GSCMetric = z.infer<typeof GSCMetricSchema>;
export type GSCResponse = z.infer<typeof GSCResponseSchema>;
export type AhrefsMetric = z.infer<typeof AhrefsMetricSchema>;
export type NormalizedMetric = z.infer<typeof NormalizedMetricSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type FilterOptions = z.infer<typeof FilterOptionsSchema>;
export type ChartDataPoint = z.infer<typeof ChartDataPointSchema>;
export type TableRow = z.infer<typeof TableRowSchema>;

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
