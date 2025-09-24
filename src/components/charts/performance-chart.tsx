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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { ChartDataPoint } from '@/lib/types';
import { formatMetricValue } from '@/lib/data-utils';
import { format, parseISO } from 'date-fns';

interface PerformanceChartProps {
  data: ChartDataPoint[];
  title?: string;
  description?: string;
  selectedMetric: string;
  onMetricChange: (metric: string) => void;
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

export function PerformanceChart({
  data,
  title = 'Performance Trends',
  description = 'Track your metrics over time',
  selectedMetric,
  onMetricChange,
  availableMetrics,
  height = 400,
  showComparison = false,
}: PerformanceChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Process data for the chart
  const chartData = useMemo(() => {
    // Group data by date and aggregate by source if showing comparison
    const grouped = new Map<string, {
      date: string;
      formattedDate: string;
      value?: number;
      gsc?: number;
      ahrefs?: number;
    }>();

    data.forEach(point => {
      if (point.metric !== selectedMetric) return;

      const key = point.date;
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          formattedDate: format(parseISO(point.date), 'MMM dd'),
        });
      }

      const entry = grouped.get(key)!;
      if (showComparison && point.source) {
        if (point.source === 'gsc') {
          entry.gsc = point.value;
        } else if (point.source === 'ahrefs') {
          entry.ahrefs = point.value;
        }
      } else {
        entry.value = (entry.value || 0) + point.value;
      }
    });

    return Array.from(grouped.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [data, selectedMetric, showComparison]);

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
              {entry.dataKey === 'value' ? selectedMetric : entry.dataKey}: {' '}
              {formatMetricValue(entry.value, selectedMetric)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    
    const firstValue = showComparison 
      ? chartData[0].gsc || chartData[0].ahrefs || 0
      : chartData[0].value || 0;
    const lastValue = showComparison
      ? chartData[chartData.length - 1].gsc || chartData[chartData.length - 1].ahrefs || 0
      : chartData[chartData.length - 1].value || 0;
    
    const change = ((lastValue - firstValue) / firstValue) * 100;
    return {
      percentage: Math.abs(change).toFixed(1),
      direction: change >= 0 ? 'up' : 'down',
    };
  }, [chartData, showComparison]);

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
            tickFormatter={(value) => formatMetricValue(value, selectedMetric)}
          />
          <Tooltip content={<CustomTooltip />} />
          {showComparison ? (
            <>
              <Bar 
                dataKey="gsc" 
                fill={METRIC_COLORS.clicks} 
                name="Google Search Console"
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="ahrefs" 
                fill={METRIC_COLORS.volume} 
                name="Ahrefs"
                radius={[2, 2, 0, 0]}
              />
              <Legend />
            </>
          ) : (
            <Bar 
              dataKey="value" 
              fill={METRIC_COLORS[selectedMetric as keyof typeof METRIC_COLORS] || '#3b82f6'}
              radius={[2, 2, 0, 0]}
            />
          )}
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
          tickFormatter={(value) => formatMetricValue(value, selectedMetric)}
        />
        <Tooltip content={<CustomTooltip />} />
        {showComparison ? (
          <>
            <Line 
              type="monotone" 
              dataKey="gsc" 
              stroke={METRIC_COLORS.clicks}
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Google Search Console"
            />
            <Line 
              type="monotone" 
              dataKey="ahrefs" 
              stroke={METRIC_COLORS.volume}
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Ahrefs"
            />
            <Legend />
          </>
        ) : (
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={METRIC_COLORS[selectedMetric as keyof typeof METRIC_COLORS] || '#3b82f6'}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        )}
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
          <Select value={selectedMetric} onValueChange={onMetricChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {availableMetrics.map(metric => (
                <SelectItem key={metric} value={metric}>
                  {metric.charAt(0).toUpperCase() + metric.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
