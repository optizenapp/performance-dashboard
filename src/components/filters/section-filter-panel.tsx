'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CalendarDays } from 'lucide-react';
import { DateRangePicker } from './date-range-picker';
import { SectionFilters, ComparisonPreset } from '@/lib/types';
import { getComparisonPresetRanges } from '@/lib/data-utils';

interface SectionFilterPanelProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  filters: SectionFilters;
  onFiltersChange: (filters: SectionFilters) => void;
  className?: string;
  showComparisonPresets?: boolean;
}

export function SectionFilterPanel({
  title,
  description,
  icon,
  filters,
  onFiltersChange,
  className = '',
  showComparisonPresets = true,
}: SectionFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilters = (updates: Partial<SectionFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const comparisonPresets = [
    { value: 'last_7d_vs_previous', label: '7 days vs Previous 7 days' },
    { value: 'last_14d_vs_previous', label: '14 days vs Previous 14 days' },
    { value: 'last_30d_vs_previous', label: '30 days vs Previous 30 days' },
    { value: 'last_60d_vs_previous', label: '60 days vs Previous 60 days' },
    { value: 'last_90d_vs_previous', label: '90 days vs Previous 90 days' },
    { value: 'last_120d_vs_previous', label: '120 days vs Previous 120 days' },
  ] as const;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon || <CalendarDays className="h-4 w-4 text-gray-500" />}
            <div>
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2 text-xs"
          >
            {isExpanded ? 'Less' : 'More'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Date Range */}
        <div>
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Date Range
          </Label>
          <DateRangePicker
            dateRange={filters.dateRange}
            onDateRangeChange={(dateRange) => updateFilters({ dateRange })}
          />
        </div>

        {/* Comparison Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor={`comparison-${title}`} className="text-xs font-medium">
            Enable Comparison
          </Label>
          <input
            id={`comparison-${title}`}
            type="checkbox"
            checked={filters.enableComparison || false}
            onChange={(e) => updateFilters({ enableComparison: e.target.checked })}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>

        {/* Comparison Settings */}
        {filters.enableComparison && isExpanded && showComparisonPresets && (
          <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Label className="text-xs font-medium">Comparison Period</Label>
            <div className="space-y-2">
              {comparisonPresets.map((preset) => (
                <label key={preset.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`comparison-preset-${title}`}
                    value={preset.value}
                    checked={filters.comparisonPreset === preset.value}
                    onChange={(e) => {
                      const value = e.target.value as ComparisonPreset;
                      const ranges = getComparisonPresetRanges(value);
                      updateFilters({ 
                        comparisonPreset: value,
                        comparisonDateRange: ranges.comparison,
                        dateRange: ranges.primary 
                      });
                    }}
                    className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-1 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{preset.label}</span>
                </label>
              ))}
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
