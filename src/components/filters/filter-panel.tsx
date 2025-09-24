'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Filter, RotateCcw } from 'lucide-react';
import { DateRangePicker } from './date-range-picker';
import { MetricSelector } from './metric-selector';
import { FilterOptions, SOURCES, ComparisonPreset } from '@/lib/types';
import { getComparisonPresetRanges } from '@/lib/data-utils';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableQueries: string[];
  availableUrls: string[];
  className?: string;
}

export function FilterPanel({ 
  filters, 
  onFiltersChange, 
  availableQueries, 
  availableUrls,
  className 
}: FilterPanelProps) {
  const [querySearch, setQuerySearch] = useState('');
  const [urlSearch, setUrlSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilters = (updates: Partial<FilterOptions>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const addQuery = (query: string) => {
    if (query && !filters.queries?.includes(query)) {
      updateFilters({
        queries: [...(filters.queries || []), query],
      });
      setQuerySearch('');
    }
  };

  const removeQuery = (query: string) => {
    updateFilters({
      queries: filters.queries?.filter(q => q !== query) || [],
    });
  };

  const addUrl = (url: string) => {
    if (url && !filters.urls?.includes(url)) {
      updateFilters({
        urls: [...(filters.urls || []), url],
      });
      setUrlSearch('');
    }
  };

  const removeUrl = (url: string) => {
    updateFilters({
      urls: filters.urls?.filter(u => u !== url) || [],
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      dateRange: filters.dateRange, // Keep date range
      metrics: ['clicks', 'impressions', 'ctr', 'position'],
      sources: [SOURCES.GSC, SOURCES.AHREFS],
      queries: [],
      urls: [],
    });
  };

  const filteredQueries = availableQueries.filter(query =>
    query.toLowerCase().includes(querySearch.toLowerCase())
  ).slice(0, 10);

  const filteredUrls = availableUrls.filter(url =>
    url.toLowerCase().includes(urlSearch.toLowerCase())
  ).slice(0, 10);

  const hasActiveFilters = 
    (filters.queries && filters.queries.length > 0) ||
    (filters.urls && filters.urls.length > 0);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Filters</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2">
              Active
            </Badge>
          )}
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Date Range and Comparison Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Date Range */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Date Range</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DateRangePicker
              dateRange={filters.dateRange}
              onDateRangeChange={(dateRange) => updateFilters({ dateRange })}
            />
          </CardContent>
        </Card>

        {/* Comparison Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparison</CardTitle>
            <CardDescription>
              Compare your data against previous periods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          {/* Enable Comparison Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-comparison">Enable Comparison</Label>
            <input
              id="enable-comparison"
              type="checkbox"
              checked={filters.enableComparison || false}
              onChange={(e) => updateFilters({ enableComparison: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {filters.enableComparison && (
            <div className="space-y-4">
              {/* Comparison Presets */}
              <div className="space-y-2">
                <Label>Comparison Period</Label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'last_24h_vs_previous', label: 'Last 24h vs Previous Period' },
                    { value: 'last_7d_vs_previous', label: 'Last 7 days vs Previous Period' },
                    { value: 'last_7d_vs_year_ago', label: 'Last 7 days vs Year Ago' },
                    { value: 'last_28d_vs_previous', label: 'Last 28 days vs Previous Period' },
                    { value: 'last_28d_vs_year_ago', label: 'Last 28 days vs Year Ago' },
                    { value: 'custom', label: 'Custom Date Range' },
                  ].map((preset) => (
                    <label key={preset.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="comparison-preset"
                        value={preset.value}
                        checked={filters.comparisonPreset === preset.value}
                        onChange={(e) => {
                          const value = e.target.value as ComparisonPreset;
                          updateFilters({ comparisonPreset: value });
                          
                          if (value !== 'custom') {
                            const ranges = getComparisonPresetRanges(value);
                            updateFilters({ 
                              comparisonDateRange: ranges.comparison,
                              dateRange: ranges.primary 
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm">{preset.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Date Range */}
              {filters.comparisonPreset === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Primary Period</Label>
                    <DateRangePicker
                      dateRange={filters.dateRange}
                      onDateRangeChange={(dateRange) => updateFilters({ dateRange })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Comparison Period</Label>
                    <DateRangePicker
                      dateRange={filters.comparisonDateRange || filters.dateRange}
                      onDateRangeChange={(comparisonDateRange) => updateFilters({ comparisonDateRange })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Metrics Selector */}
      <MetricSelector
        selectedMetrics={filters.metrics.filter(metric => metric !== 'volume' && metric !== 'traffic')}
        onMetricsChange={(metrics) => updateFilters({ metrics: metrics as ('clicks' | 'impressions' | 'ctr' | 'position' | 'volume' | 'traffic')[] })}
        selectedSources={filters.sources}
        onSourcesChange={(sources) => updateFilters({ sources: sources as ('gsc' | 'ahrefs')[] })}
        availableMetrics={filters.metrics.filter(metric => metric !== 'volume' && metric !== 'traffic')}
      />

      {/* Advanced Filters - Only show when expanded */}
      {isExpanded && (
        <>
          {/* Query Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search Queries</CardTitle>
              <CardDescription>
                Filter by specific search queries or keywords
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selected Queries */}
              {filters.queries && filters.queries.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filters.queries.map(query => (
                    <Badge
                      key={query}
                      variant="secondary"
                      className="cursor-pointer hover:bg-red-100"
                      onClick={() => removeQuery(query)}
                    >
                      {query}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Query Search */}
              <div className="space-y-2">
                <Label htmlFor="query-search">Add Query</Label>
                <div className="flex space-x-2">
                  <Input
                    id="query-search"
                    placeholder="Search queries..."
                    value={querySearch}
                    onChange={(e) => setQuerySearch(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addQuery(querySearch);
                      }
                    }}
                  />
                  <Button
                    onClick={() => addQuery(querySearch)}
                    disabled={!querySearch}
                    size="sm"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Query Suggestions */}
              {querySearch && filteredQueries.length > 0 && (
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto">
                  <div className="text-xs text-gray-500 mb-2">Suggestions:</div>
                  {filteredQueries.map(query => (
                    <div
                      key={query}
                      className="text-sm p-1 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded"
                      onClick={() => addQuery(query)}
                    >
                      {query}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* URL Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">URLs</CardTitle>
              <CardDescription>
                Filter by specific pages or URL patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selected URLs */}
              {filters.urls && filters.urls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filters.urls.map(url => (
                    <Badge
                      key={url}
                      variant="secondary"
                      className="cursor-pointer hover:bg-red-100"
                      onClick={() => removeUrl(url)}
                    >
                      {url}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* URL Search */}
              <div className="space-y-2">
                <Label htmlFor="url-search">Add URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="url-search"
                    placeholder="Search URLs..."
                    value={urlSearch}
                    onChange={(e) => setUrlSearch(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addUrl(urlSearch);
                      }
                    }}
                  />
                  <Button
                    onClick={() => addUrl(urlSearch)}
                    disabled={!urlSearch}
                    size="sm"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* URL Suggestions */}
              {urlSearch && filteredUrls.length > 0 && (
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto">
                  <div className="text-xs text-gray-500 mb-2">Suggestions:</div>
                  {filteredUrls.map(url => (
                    <div
                      key={url}
                      className="text-sm p-1 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded"
                      onClick={() => addUrl(url)}
                    >
                      {url}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
