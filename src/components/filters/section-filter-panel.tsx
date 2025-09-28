'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
    <Accordion type="single" collapsible className={`${className} w-full`}>
      <AccordionItem value="filters" className="border rounded-lg">
        <AccordionTrigger className="px-4 py-2 hover:no-underline data-[state=closed]:rounded-lg">
          <div className="flex items-center space-x-3 text-left">
            {icon || <CalendarDays className="h-5 w-5 text-gray-500" />}
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pt-4 pb-4 border-t">
          <div className="space-y-4">
            {/* --- Main Controls --- */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Range - Hide for all Ahrefs tables */}
              {activeTab !== 'ahrefs' && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Date Range
                  </Label>
                  <DateRangePicker
                    dateRange={filters.dateRange}
                    onDateRangeChange={(dateRange) => updateFilters({ dateRange })}
                  />
                </div>
              )}

              {/* Comparison Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id={`comparison-${title}`}
                  checked={filters.enableComparison || false}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // When enabling comparison, calculate default date ranges
                      const defaultPreset = filters.comparisonPreset || 'last_30d_vs_previous';
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
                />
                <Label htmlFor={`comparison-${title}`} className="text-xs font-medium">
                  Enable Comparison
                </Label>
              </div>
            </div>
            
            {/* --- Conditional Filters --- */}

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
            {activeTab !== 'ahrefs' && filters.enableComparison && showComparisonPresets && (
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
                          
                          // Calculate the date ranges for the preset
                          const ranges = getGSCComparisonRanges(value);
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

                {/* Show calculated ranges for presets */}
                {filters.comparisonPreset && (
                  <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-3 rounded mt-3">
                    <div><strong>Primary Period:</strong> {filters.dateRange.startDate} to {filters.dateRange.endDate}</div>
                    {filters.comparisonDateRange && (
                      <div><strong>Comparison Period:</strong> {filters.comparisonDateRange.startDate} to {filters.comparisonDateRange.endDate}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
