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
import { ChartDataPoint } from '@/lib/types';
import { formatMetricValue } from '@/lib/data-utils';
import { format, parseISO } from 'date-fns';

interface PerformanceChartProps {
  data: ChartDataPoint[];
  title?: string;
  description?: string;
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
  availableMetrics: string[];
  height?: number;
  showComparison?: boolean;
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
  title = 'Performance Trends',
  description = 'Track your metrics over time',
  selectedMetrics,
  onMetricsChange,
  availableMetrics,
  height = 400,
  // showComparison = false, // Unused in multi-metric mode
}: PerformanceChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const toggleMetric = (metric: string) => {
    if (selectedMetrics.includes(metric)) {
      onMetricsChange(selectedMetrics.filter(m => m !== metric));
    } else {
      onMetricsChange([...selectedMetrics, metric]);
    }
  };

  // Process data for the chart
  const chartData = useMemo(() => {
    // Group data by date
    const grouped = new Map<string, {
      date: string;
      formattedDate: string;
      [key: string]: string | number | undefined;
    }>();

    data.forEach(point => {
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
  }, [data, selectedMetrics]);

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

  const renderChart = () => {
    const commonProps = {
      data: chartData,
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
        {selectedMetrics.map(metric => (
          <Line 
            key={metric}
            type="monotone" 
            dataKey={metric}
            stroke={METRIC_COLORS[metric as keyof typeof METRIC_COLORS] || '#3b82f6'}
            strokeWidth={2}
            dot={{ r: 4 }}
            name={METRIC_LABELS[metric as keyof typeof METRIC_LABELS] || metric}
          />
        ))}
        {selectedMetrics.length > 1 && <Legend />}
      </LineChart>
    );
  };

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
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
