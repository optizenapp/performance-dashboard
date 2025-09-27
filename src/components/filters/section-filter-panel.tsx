'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CalendarDays } from 'lucide-react';
import { DateRangePicker } from './date-range-picker';
import { SectionFilters, ComparisonPreset, AhrefsComparisonFilter, AhrefsLastUpdatedFilter } from '@/lib/types';
import { getGSCComparisonRanges } from '@/lib/data-utils';

interface SectionFilterPanelProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  filters: SectionFilters;
  onFiltersChange: (filters: SectionFilters) => void;
  className?: string;
  showComparisonPresets?: boolean;
  activeTab?: string; // For Ahrefs-specific filters
}

export function SectionFilterPanel({
  title,
  description,
  icon,
  filters,
  onFiltersChange,
  className = '',
  showComparisonPresets = true,
  activeTab = 'gsc',
}: SectionFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilters = (updates: Partial<SectionFilters>) => {
    console.log('🔄 SectionFilterPanel updateFilters called:', {
      title,
      updates,
      oldFilters: filters,
      newFilters: { ...filters, ...updates }
    });
    onFiltersChange({ ...filters, ...updates });
  };

  const comparisonPresets = [
    // Previous period comparisons
    { value: 'last_24h_vs_previous', label: 'Compare last 24 hours to previous period' },
    { value: 'last_7d_vs_previous', label: 'Compare last 7 days to previous period' },
    { value: 'last_28d_vs_previous', label: 'Compare last 28 days to previous period' },
    { value: 'last_3m_vs_previous', label: 'Compare last 3 months to previous period' },
    { value: 'last_6m_vs_previous', label: 'Compare last 6 months to previous period' },
    
    // Week over week comparisons  
    { value: 'last_24h_week_over_week', label: 'Compare last 24 hours week over week' },
    { value: 'last_7d_week_over_week', label: 'Compare last 7 days week over week' },
    
    // Year over year comparisons
    { value: 'last_7d_year_over_year', label: 'Compare last 7 days year over year' },
    { value: 'last_28d_year_over_year', label: 'Compare last 28 days year over year' },
    { value: 'last_3m_year_over_year', label: 'Compare last 3 months year over year' },
    
    // Custom
    { value: 'custom', label: 'Custom' },
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
        {/* Date Range - Hide for all Ahrefs tables */}
        {activeTab !== 'ahrefs' && (
          <div>
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Date Range
            </Label>
            <DateRangePicker
              dateRange={filters.dateRange}
              onDateRangeChange={(dateRange) => updateFilters({ dateRange })}
            />
          </div>
        )}

        {/* Comparison Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor={`comparison-${title}`} className="text-xs font-medium">
            Enable Comparison
          </Label>
          <input
            id={`comparison-${title}`}
            type="checkbox"
            checked={filters.enableComparison || false}
            onChange={(e) => {
              const checked = e.target.checked;
              if (checked) {
                // When enabling comparison, calculate default date ranges
                const defaultPreset = filters.comparisonPreset || 'last_28d_vs_previous';
                const ranges = getGSCComparisonRanges(defaultPreset);
                updateFilters({ 
                  enableComparison: checked,
                  comparisonPreset: defaultPreset,
                  comparisonDateRange: ranges.comparison,
                  dateRange: ranges.primary
                });
              } else {
                // When disabling, just set enableComparison to false
                updateFilters({ enableComparison: checked });
              }
            }}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>

        {/* Ahrefs Last Updated Filter (Non-Comparison) */}
        {activeTab === 'ahrefs' && !filters.enableComparison && (
          <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Label className="text-xs font-medium">
              Last Updated Filter
            </Label>
            <div className="space-y-2">
              {[
                { value: 'all', label: 'All data' },
                { value: 'last_5_days', label: 'Last 5 days' },
                { value: 'last_6_10_days', label: '6-10 days ago' },
                { value: 'last_11_20_days', label: '11-20 days ago' },
                { value: 'last_21_plus_days', label: '21+ days ago' }
              ].map((option) => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`ahrefs-last-updated-${title}`}
                    value={option.value}
                    checked={filters.ahrefsLastUpdatedFilter === option.value || (option.value === 'all' && !filters.ahrefsLastUpdatedFilter)}
                    onChange={(e) => {
                      const value = e.target.value as AhrefsLastUpdatedFilter;
                      updateFilters({ 
                        ahrefsLastUpdatedFilter: value
                      });
                    }}
                    className="w-3 h-3 text-orange-600 bg-gray-100 border-gray-300 focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-1 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Ahrefs Comparison Filter (Comparison Mode) */}
        {activeTab === 'ahrefs' && filters.enableComparison && (
          <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Label className="text-xs font-medium">
              Show Changes In
            </Label>
            <div className="space-y-2">
              {[
                { value: 'all_data', label: 'All data (no filtering)' },
                { value: 'all_changes', label: 'All changes' },
                { value: 'last_24_hours', label: 'Last 24 hours' },
                { value: 'last_7_days', label: 'Last 7 days' },
                { value: 'last_14_days', label: 'Last 14 days' },
                { value: 'last_30_days', label: 'Last 30 days' },
                { value: 'last_60_days', label: 'Last 60 days' },
                { value: 'last_90_days', label: 'Last 90 days' },
                { value: 'last_6_months', label: 'Last 6 months' }
              ].map((option) => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`ahrefs-comparison-filter-${title}`}
                    value={option.value}
                    checked={filters.ahrefsComparisonFilter === option.value || (option.value === 'all_data' && !filters.ahrefsComparisonFilter)}
                    onChange={(e) => {
                      const value = e.target.value as AhrefsComparisonFilter;
                      updateFilters({ 
                        ahrefsComparisonFilter: value
                      });
                    }}
                    className="w-3 h-3 text-orange-600 bg-gray-100 border-gray-300 focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-1 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* GSC Comparison Settings */}
        {activeTab !== 'ahrefs' && filters.enableComparison && isExpanded && showComparisonPresets && (
          <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Label className="text-xs font-medium">
              Comparison Period
            </Label>
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
                      
                      if (value === 'custom') {
                        // For custom, just set the preset and keep current dates
                        updateFilters({ 
                          comparisonPreset: value
                        });
                      } else {
                        // For presets, calculate the date ranges
                        const ranges = getGSCComparisonRanges(value);
                        updateFilters({ 
                          comparisonPreset: value,
                          comparisonDateRange: ranges.comparison,
                          dateRange: ranges.primary 
                        });
                      }
                    }}
                    className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-1 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{preset.label}</span>
                </label>
              ))}
            </div>

            {/* Custom Date Range Selectors (only show for custom preset and GSC) */}
            {activeTab !== 'ahrefs' && filters.comparisonPreset === 'custom' && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Primary Period</Label>
                  <DateRangePicker
                    dateRange={filters.dateRange}
                    onDateRangeChange={(range) => updateFilters({ dateRange: range })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Comparison Period</Label>
                  <DateRangePicker
                    dateRange={filters.comparisonDateRange || { startDate: '', endDate: '' }}
                    onDateRangeChange={(range) => updateFilters({ comparisonDateRange: range })}
                    className="w-full"
                  />
                </div>
              </div>
            )}
            
            {/* Show calculated ranges for presets (hide for custom) */}
            {filters.comparisonPreset !== 'custom' && (
              <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-3 rounded mt-3">
                <div><strong>Primary Period:</strong> {filters.dateRange.startDate} to {filters.dateRange.endDate}</div>
                {filters.comparisonDateRange && (
                  <div><strong>Comparison Period:</strong> {filters.comparisonDateRange.startDate} to {filters.comparisonDateRange.endDate}</div>
                )}
              </div>
            )}

          </div>
        )}
      </CardContent>
    </Card>
  );
}
