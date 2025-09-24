'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { METRICS } from '@/lib/types';

interface MetricSelectorProps {
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
  availableMetrics?: string[];
  className?: string;
}

const METRIC_LABELS = {
  [METRICS.CLICKS]: 'Clicks',
  [METRICS.IMPRESSIONS]: 'Impressions',
  [METRICS.CTR]: 'CTR (%)',
  [METRICS.POSITION]: 'Avg. Position',
  [METRICS.VOLUME]: 'Search Volume',
  [METRICS.TRAFFIC]: 'Traffic',
} as const;

const METRIC_DESCRIPTIONS = {
  [METRICS.CLICKS]: 'Number of clicks from search results',
  [METRICS.IMPRESSIONS]: 'Number of times your pages appeared in search',
  [METRICS.CTR]: 'Click-through rate percentage',
  [METRICS.POSITION]: 'Average ranking position',
  [METRICS.VOLUME]: 'Monthly search volume for keywords',
  [METRICS.TRAFFIC]: 'Estimated organic traffic',
} as const;

const METRIC_COLORS = {
  [METRICS.CLICKS]: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  [METRICS.IMPRESSIONS]: 'bg-green-100 text-green-800 hover:bg-green-200',
  [METRICS.CTR]: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  [METRICS.POSITION]: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
  [METRICS.VOLUME]: 'bg-pink-100 text-pink-800 hover:bg-pink-200',
  [METRICS.TRAFFIC]: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
} as const;

export function MetricSelector({ 
  selectedMetrics, 
  onMetricsChange, 
  availableMetrics = Object.values(METRICS),
  className 
}: MetricSelectorProps) {
  const [showAll, setShowAll] = useState(false);

  const toggleMetric = (metric: string) => {
    if (selectedMetrics.includes(metric)) {
      onMetricsChange(selectedMetrics.filter(m => m !== metric));
    } else {
      onMetricsChange([...selectedMetrics, metric]);
    }
  };

  const selectAll = () => {
    onMetricsChange(availableMetrics);
  };

  const clearAll = () => {
    onMetricsChange([]);
  };

  const displayMetrics = showAll ? availableMetrics : availableMetrics.slice(0, 4);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Metrics</CardTitle>
            <CardDescription>
              Select the metrics you want to analyze
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={selectAll}
              disabled={selectedMetrics.length === availableMetrics.length}
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearAll}
              disabled={selectedMetrics.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Selected Metrics Summary */}
          {selectedMetrics.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Selected ({selectedMetrics.length}):
              </span>
              {selectedMetrics.map(metric => (
                <Badge 
                  key={metric}
                  variant="secondary"
                  className={cn(
                    'cursor-pointer transition-colors',
                    METRIC_COLORS[metric as keyof typeof METRIC_COLORS]
                  )}
                  onClick={() => toggleMetric(metric)}
                >
                  {METRIC_LABELS[metric as keyof typeof METRIC_LABELS]}
                  <span className="ml-1 text-xs">×</span>
                </Badge>
              ))}
            </div>
          )}

          {/* Metric Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayMetrics.map(metric => {
              const isSelected = selectedMetrics.includes(metric);
              return (
                <div
                  key={metric}
                  className={cn(
                    'p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm',
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  )}
                  onClick={() => toggleMetric(metric)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <div
                          className={cn(
                            'w-3 h-3 rounded-full',
                            isSelected ? 'bg-blue-500' : 'bg-gray-300'
                          )}
                        />
                        <span className="font-medium">
                          {METRIC_LABELS[metric as keyof typeof METRIC_LABELS]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {METRIC_DESCRIPTIONS[metric as keyof typeof METRIC_DESCRIPTIONS]}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show More/Less Button */}
          {availableMetrics.length > 4 && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show Less' : `Show ${availableMetrics.length - 4} More`}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
