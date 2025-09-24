'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Filter, RotateCcw, TrendingUp } from 'lucide-react';
import { DateRangePicker } from './date-range-picker';
import { MetricSelector } from './metric-selector';
import { FilterOptions, SOURCES } from '@/lib/types';
import { getComparisonDateRange } from '@/lib/data-utils';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

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

  const toggleSource = (source: string) => {
    const newSources = filters.sources.includes(source as 'gsc' | 'ahrefs')
      ? filters.sources.filter(s => s !== source)
      : [...filters.sources, source as 'gsc' | 'ahrefs'];
    
    updateFilters({ sources: newSources });
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
    (filters.urls && filters.urls.length > 0) ||
    filters.sources.length < 2;

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
          
          {/* Comparison Toggle */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <Label htmlFor="comparison-toggle" className="text-sm font-medium">
                Compare with previous period
              </Label>
            </div>
            <Switch
              id="comparison-toggle"
              checked={filters.enableComparison || false}
              onCheckedChange={(checked) => {
                const updates: Partial<FilterOptions> = { enableComparison: checked };
                if (checked && !filters.comparisonDateRange) {
                  updates.comparisonDateRange = getComparisonDateRange(filters.dateRange);
                }
                updateFilters(updates);
              }}
            />
          </div>
          
          {/* Comparison Date Range */}
          {filters.enableComparison && (
            <div className="space-y-2 pt-2">
              <Label className="text-sm text-gray-600">Comparison Period</Label>
              <DateRangePicker
                dateRange={filters.comparisonDateRange || getComparisonDateRange(filters.dateRange)}
                onDateRangeChange={(comparisonDateRange) => updateFilters({ comparisonDateRange })}
              />
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ 
                    comparisonDateRange: getComparisonDateRange(filters.dateRange, 'previous_period') 
                  })}
                >
                  Previous Period
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ 
                    comparisonDateRange: getComparisonDateRange(filters.dateRange, 'previous_year') 
                  })}
                >
                  Previous Year
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Sources</CardTitle>
          <CardDescription>
            Select which data sources to include in your analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div
              className={cn(
                'flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
                filters.sources.includes(SOURCES.GSC)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 dark:border-gray-700'
              )}
              onClick={() => toggleSource(SOURCES.GSC)}
            >
              <div
                className={cn(
                  'w-3 h-3 rounded-full',
                  filters.sources.includes(SOURCES.GSC) ? 'bg-blue-500' : 'bg-gray-300'
                )}
              />
              <span className="font-medium">Google Search Console</span>
            </div>
            <div
              className={cn(
                'flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
                filters.sources.includes(SOURCES.AHREFS)
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                  : 'border-gray-200 dark:border-gray-700'
              )}
              onClick={() => toggleSource(SOURCES.AHREFS)}
            >
              <div
                className={cn(
                  'w-3 h-3 rounded-full',
                  filters.sources.includes(SOURCES.AHREFS) ? 'bg-orange-500' : 'bg-gray-300'
                )}
              />
              <span className="font-medium">Ahrefs</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Selector */}
      <MetricSelector
        selectedMetrics={filters.metrics}
        onMetricsChange={(metrics) => updateFilters({ metrics: metrics as ('clicks' | 'impressions' | 'ctr' | 'position' | 'volume' | 'traffic')[] })}
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
