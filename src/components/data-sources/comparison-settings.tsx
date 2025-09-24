'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp } from 'lucide-react';
import { FilterOptions, ComparisonPreset } from '@/lib/types';
import { getComparisonPresetRanges, getComparisonDateRange } from '@/lib/data-utils';
import { DateRangePicker } from '@/components/filters/date-range-picker';

interface ComparisonSettingsProps {
  filters: FilterOptions;
  onFiltersChange: (filters: Partial<FilterOptions>) => void;
}

export function ComparisonSettings({ filters, onFiltersChange }: ComparisonSettingsProps) {
  const updateFilters = (updates: Partial<FilterOptions>) => {
    onFiltersChange(updates);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center space-x-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <span>Comparison Settings</span>
        </CardTitle>
        <CardDescription>
          Configure comparison periods for data imports. This affects how GSC data is fetched and what Ahrefs export format is expected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable Comparison Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="comparison-toggle" className="text-sm font-medium">
            Enable Comparison Mode
          </Label>
          <Switch
            id="comparison-toggle"
            checked={filters.enableComparison || false}
            onCheckedChange={(checked) => {
              const updates: Partial<FilterOptions> = { enableComparison: checked };
              if (checked) {
                updates.comparisonPreset = 'last_28d_vs_previous';
                const ranges = getComparisonPresetRanges('last_28d_vs_previous');
                updates.dateRange = ranges.primary;
                updates.comparisonDateRange = ranges.comparison;
              }
              updateFilters(updates);
            }}
          />
        </div>
        
        {/* Comparison Options */}
        {filters.enableComparison && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Comparison Period</Label>
              <Select
                value={filters.comparisonPreset || 'last_28d_vs_previous'}
                onValueChange={(preset: ComparisonPreset) => {
                  if (preset === 'custom') {
                    updateFilters({ comparisonPreset: preset });
                  } else {
                    const ranges = getComparisonPresetRanges(preset);
                    updateFilters({
                      comparisonPreset: preset,
                      dateRange: ranges.primary,
                      comparisonDateRange: ranges.comparison,
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_24h_vs_previous">Compare last 24 hours to previous period</SelectItem>
                  <SelectItem value="last_24h_vs_week_ago">Compare last 24 hours week over week</SelectItem>
                  <SelectItem value="last_7d_vs_previous">Compare last 7 days to previous period</SelectItem>
                  <SelectItem value="last_7d_vs_year_ago">Compare last 7 days year over year</SelectItem>
                  <SelectItem value="last_28d_vs_previous">Compare last 28 days to previous period</SelectItem>
                  <SelectItem value="last_28d_vs_year_ago">Compare last 28 days year over year</SelectItem>
                  <SelectItem value="last_3m_vs_previous">Compare last 3 months to previous period</SelectItem>
                  <SelectItem value="last_3m_vs_year_ago">Compare last 3 months year over year</SelectItem>
                  <SelectItem value="last_6m_vs_previous">Compare last 6 months to previous period</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Custom Date Ranges */}
            {filters.comparisonPreset === 'custom' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-gray-600">Primary Period</Label>
                  <DateRangePicker
                    dateRange={filters.dateRange}
                    onDateRangeChange={(dateRange) => updateFilters({ dateRange })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-gray-600">Comparison Period</Label>
                  <DateRangePicker
                    dateRange={filters.comparisonDateRange || getComparisonDateRange(filters.dateRange)}
                    onDateRangeChange={(comparisonDateRange) => updateFilters({ comparisonDateRange })}
                  />
                </div>
              </div>
            )}
            
            {/* Show calculated ranges for presets */}
            {filters.comparisonPreset !== 'custom' && (
              <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                <div><strong>Primary Period:</strong> {filters.dateRange.startDate} to {filters.dateRange.endDate}</div>
                <div><strong>Comparison Period:</strong> {filters.comparisonDateRange?.startDate} to {filters.comparisonDateRange?.endDate}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
