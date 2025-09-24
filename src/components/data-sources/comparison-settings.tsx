'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp } from 'lucide-react';
import { FilterOptions, ComparisonPreset } from '@/lib/types';
import { getComparisonPresetRanges } from '@/lib/data-utils';

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
          Configure comparison periods for data imports. GSC fetches full date ranges. Ahrefs compares two specific dates (end dates of each period) for point-in-time changes.
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
                updates.comparisonPreset = 'last_30d_vs_previous';
                const ranges = getComparisonPresetRanges('last_30d_vs_previous');
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
                value={filters.comparisonPreset || 'last_30d_vs_previous'}
                onValueChange={(preset: ComparisonPreset) => {
                  const ranges = getComparisonPresetRanges(preset);
                  updateFilters({
                    comparisonPreset: preset,
                    dateRange: ranges.primary,
                    comparisonDateRange: ranges.comparison,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_7d_vs_previous">7 days vs Previous 7 days</SelectItem>
                  <SelectItem value="last_14d_vs_previous">14 days vs Previous 14 days</SelectItem>
                  <SelectItem value="last_30d_vs_previous">30 days vs Previous 30 days</SelectItem>
                  <SelectItem value="last_60d_vs_previous">60 days vs Previous 60 days</SelectItem>
                  <SelectItem value="last_90d_vs_previous">90 days vs Previous 90 days</SelectItem>
                  <SelectItem value="last_120d_vs_previous">120 days vs Previous 120 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Show calculated ranges for presets */}
            <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <div><strong>Primary Period:</strong> {filters.dateRange.startDate} to {filters.dateRange.endDate}</div>
              <div><strong>Comparison Period:</strong> {filters.comparisonDateRange?.startDate} to {filters.comparisonDateRange?.endDate}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
