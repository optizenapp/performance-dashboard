'use client';

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { ChartDataPoint, SectionFilters } from '@/lib/types';
import { formatMetricValue } from '@/lib/data-utils';
import { SectionFilterPanel } from '@/components/filters/section-filter-panel';
import { format, parseISO } from 'date-fns';

interface PerformanceChartProps {
  data: ChartDataPoint[];
  comparisonData?: ChartDataPoint[]; // NEW: Comparison period data
  title?: string;
  description?: string;
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
  availableMetrics: string[];
  height?: number;
  sectionFilters?: SectionFilters;
  showSectionFilters?: boolean;
  onSectionFiltersChange?: (filters: SectionFilters) => void;
  loading?: boolean; // NEW: Loading state
  error?: string | null; // NEW: Error state
}

const METRIC_COLORS = {
  clicks: '#3b82f6',
  impressions: '#10b981',
  ctr: '#8b5cf6',
  position: '#f59e0b',
  volume: '#ec4899',
  traffic: '#6366f1',
} as const;

// const CHART_TYPES = {
//   LINE: 'line',
//   BAR: 'bar',
// } as const;

const METRIC_LABELS = {
  clicks: 'Clicks',
  impressions: 'Impressions',
  ctr: 'CTR (%)',
  position: 'Avg. Position',
  volume: 'Search Volume',
  traffic: 'Traffic',
} as const;

const METRIC_BG_COLORS = {
  clicks: 'bg-blue-600',
  impressions: 'bg-green-600',
  ctr: 'bg-purple-600',
  position: 'bg-orange-600',
  volume: 'bg-pink-600',
  traffic: 'bg-indigo-600',
} as const;

const getMetricColorClass = (metric: string): string => {
  return METRIC_BG_COLORS[metric as keyof typeof METRIC_BG_COLORS] || 'bg-gray-600';
};

export function PerformanceChart({
  data,
  comparisonData,
  title = 'Performance Trends',
  description = 'Track your metrics over time',
  selectedMetrics,
  onMetricsChange,
  availableMetrics,
  height = 400,
  sectionFilters,
  showSectionFilters = false,
  onSectionFiltersChange,
  loading = false,
  error = null,
}: PerformanceChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const toggleMetric = (metric: string) => {
    if (selectedMetrics.includes(metric)) {
      onMetricsChange(selectedMetrics.filter(m => m !== metric));
    } else {
      onMetricsChange([...selectedMetrics, metric]);
    }
  };

  // Process data for the chart - filter by date range and group by date
  const chartData = useMemo(() => {
    // Filter data by section date range if provided
    let filteredData = data;
    if (sectionFilters?.dateRange?.startDate && sectionFilters?.dateRange?.endDate) {
      const startDate = new Date(sectionFilters.dateRange.startDate);
      const endDate = new Date(sectionFilters.dateRange.endDate);
      
      filteredData = data.filter(point => {
        const pointDate = new Date(point.date);
        return pointDate >= startDate && pointDate <= endDate;
      });
    }

    // Group data by date
    const grouped = new Map<string, {
      date: string;
      formattedDate: string;
      [key: string]: string | number | undefined;
    }>();

    filteredData.forEach(point => {
      // Only include data for selected metrics
      if (!selectedMetrics.includes(point.metric)) return;

      const key = point.date;
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          formattedDate: format(parseISO(point.date), 'MMM dd'),
        });
      }

      const entry = grouped.get(key)!;
      const metricKey = point.metric;
      
      // Aggregate values for each metric
      entry[metricKey] = (entry[metricKey] as number || 0) + point.value;
    });

    return Array.from(grouped.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [data, selectedMetrics, sectionFilters]);

  // Process comparison data - now using external comparisonData prop
  const comparisonChartData = useMemo(() => {
    if (!sectionFilters?.enableComparison || !comparisonData || comparisonData.length === 0) {
      console.log('📊 No comparison data:', {
        enableComparison: sectionFilters?.enableComparison,
        comparisonDataLength: comparisonData?.length || 0
      });
      return [];
    }

    console.log('📊 Processing comparison chart data:', {
      comparisonDataLength: comparisonData.length,
      selectedMetrics,
      sampleData: comparisonData.slice(0, 3)
    });

    // Group comparison data by date (similar to primary data processing)
    const comparisonGrouped = new Map<string, {
      date: string;
      formattedDate: string;
      [key: string]: string | number | undefined;
    }>();

    comparisonData.forEach(point => {
      // Only include data for selected metrics
      if (!selectedMetrics.includes(point.metric)) return;

      const key = point.date;
      if (!comparisonGrouped.has(key)) {
        comparisonGrouped.set(key, {
          date: key,
          formattedDate: format(parseISO(point.date), 'MMM dd'),
        });
      }

      const entry = comparisonGrouped.get(key)!;
      const metricKey = point.metric;
      
      // Aggregate values for each metric
      entry[metricKey] = (entry[metricKey] as number || 0) + point.value;
    });

    const result = Array.from(comparisonGrouped.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    console.log('📊 Comparison chart data processed:', {
      inputLength: comparisonData.length,
      outputLength: result.length,
      sampleResult: result.slice(0, 3)
    });

    return result;
  }, [comparisonData, selectedMetrics, sectionFilters?.enableComparison]);

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ color: string; dataKey: string; value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {METRIC_LABELS[entry.dataKey as keyof typeof METRIC_LABELS] || entry.dataKey}: {' '}
              {formatMetricValue(entry.value, entry.dataKey)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate trend for the first selected metric
  const trend = useMemo(() => {
    if (chartData.length < 2 || selectedMetrics.length === 0) return null;
    
    // Group data by date to get trend for first metric
    const metricData = chartData.filter(point => point.metric === selectedMetrics[0]);
    if (metricData.length < 2) return null;
    
    const firstValue = Number(metricData[0].value) || 0;
    const lastValue = Number(metricData[metricData.length - 1].value) || 0;
    
    if (firstValue === 0) return null;
    
    const change = ((lastValue - firstValue) / firstValue) * 100;
    return {
      percentage: Math.abs(change).toFixed(1),
      direction: change >= 0 ? 'up' : 'down',
    };
  }, [chartData, selectedMetrics]);

  // Merge current and comparison data for chart rendering
  const mergedChartData = useMemo(() => {
    if (!sectionFilters?.enableComparison || comparisonChartData.length === 0) {
      return chartData;
    }

    // Map comparison data by index (day position) instead of exact date
    // This ensures Day 1 of current period compares to Day 1 of comparison period
    const merged = chartData.map((currentItem, index) => {
      const comparisonItem = comparisonChartData[index];
      
      if (comparisonItem) {
        return {
          ...currentItem,
          clicks_comparison: comparisonItem.clicks,
          impressions_comparison: comparisonItem.impressions,
          ctr_comparison: comparisonItem.ctr,
          position_comparison: comparisonItem.position,
        };
      }
      
      return currentItem;
    });


    return merged;
  }, [chartData, comparisonChartData, sectionFilters]);

  const renderChart = () => {
    const commonProps = {
      data: mergedChartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="formattedDate" 
            className="text-xs"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            className="text-xs"
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          {selectedMetrics.map(metric => (
            <Bar 
              key={metric}
              dataKey={metric}
              fill={METRIC_COLORS[metric as keyof typeof METRIC_COLORS] || '#3b82f6'}
              name={METRIC_LABELS[metric as keyof typeof METRIC_LABELS] || metric}
              radius={[2, 2, 0, 0]}
            />
          ))}
          {selectedMetrics.length > 1 && <Legend />}
        </BarChart>
      );
    }

    return (
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis 
          dataKey="formattedDate" 
          className="text-xs"
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          className="text-xs"
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {/* Current period lines (solid) */}
        {selectedMetrics.map(metric => (
          <Line 
            key={`current-${metric}`}
            type="monotone" 
            dataKey={metric}
            stroke={METRIC_COLORS[metric as keyof typeof METRIC_COLORS] || '#3b82f6'}
            strokeWidth={2}
            dot={{ r: 4 }}
            name={`${METRIC_LABELS[metric as keyof typeof METRIC_LABELS] || metric} (Current)`}
          />
        ))}
        
        {/* Comparison period lines (dashed) - only show if comparison is enabled */}
        {sectionFilters?.enableComparison && comparisonChartData.length > 0 && selectedMetrics.map(metric => (
          <Line 
            key={`comparison-${metric}`}
            type="monotone" 
            dataKey={`${metric}_comparison`}
            stroke={METRIC_COLORS[metric as keyof typeof METRIC_COLORS] || '#3b82f6'}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3 }}
            name={`${METRIC_LABELS[metric as keyof typeof METRIC_LABELS] || metric} (Previous)`}
          />
        ))}
        
        {(selectedMetrics.length > 1 || (sectionFilters?.enableComparison && comparisonChartData.length > 0)) && <Legend />}
      </LineChart>
    );
  };

  // Show loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading chart data...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-red-600" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-sm text-red-600 mb-2">Failed to load chart data</p>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {trend && (
            <div className="text-right">
              <div className={`text-sm font-medium ${
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend.direction === 'up' ? '↗' : '↘'} {trend.percentage}%
              </div>
              <div className="text-xs text-gray-500">vs previous period</div>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4 mt-4">
          {/* Metric Toggle Buttons */}
          <div className="flex flex-wrap gap-2">
            {availableMetrics.map(metric => {
              const isSelected = selectedMetrics.includes(metric);
              const colorClass = getMetricColorClass(metric);
              return (
                <Button
                  key={metric}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleMetric(metric)}
                  className={isSelected ? `${colorClass} text-white border-0` : 'hover:bg-gray-50'}
                >
                  {METRIC_LABELS[metric as keyof typeof METRIC_LABELS] || metric}
                </Button>
              );
            })}
          </div>

          <div className="flex space-x-2">
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
            >
              <LineChartIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('bar')}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section-specific filters */}
        {showSectionFilters && sectionFilters && onSectionFiltersChange && (
          <SectionFilterPanel
            title="Chart Filters"
            description="Control date range and comparison for charts"
            icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
            filters={sectionFilters}
            onFiltersChange={onSectionFiltersChange}
            className="border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20"
          />
        )}
        
        {/* Chart */}
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
