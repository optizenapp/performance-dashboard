'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  Download,
  ExternalLink,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { NormalizedMetric, SectionFilters } from '@/lib/types';
import { exportToCSV } from '@/lib/data-utils';

interface GSCComparisonTableRow {
  query: string;
  url: string;
  // Current period
  clicksCurrent: number;
  impressionsCurrent: number;
  ctrCurrent: number;
  avgPositionCurrent: number;
  // Previous period
  clicksPrevious: number;
  impressionsPrevious: number;
  ctrPrevious: number;
  avgPositionPrevious: number;
  // Changes
  clicksChange: number;
  clicksChangePercent: number;
  impressionsChange: number;
  impressionsChangePercent: number;
  ctrChange: number;
  ctrChangePercent: number;
  avgPositionChange: number;
  avgPositionChangePercent: number;
}

interface GSCComparisonTableProps {
  data: any[]; // NEW: GSC API data format (primary period)
  comparisonData: any[]; // NEW: GSC API data format (comparison period)
  loading?: boolean;
  error?: string | null;
  sectionFilters: SectionFilters;
}

type SortField = keyof GSCComparisonTableRow;
type SortDirection = 'asc' | 'desc' | null;

export function GSCComparisonTable({
  data,
  comparisonData,
  loading = false,
  error = null,
  sectionFilters,
}: GSCComparisonTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('clicksChangePercent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50);

  // Simple validation for debugging
  const hasValidData = useMemo(() => {
    const isValid = data && data.length > 0 && comparisonData && comparisonData.length > 0;
    console.log('🔍 GSC Comparison - hasValidData check:', {
      dataExists: !!data,
      dataLength: data?.length || 0,
      comparisonDataExists: !!comparisonData,
      comparisonDataLength: comparisonData?.length || 0,
      isValid
    });
    return isValid;
  }, [data, comparisonData]);

  // Process GSC API comparison data into table rows
  const processedData = useMemo(() => {
    if (!sectionFilters.enableComparison || !sectionFilters.comparisonDateRange) {
      return [];
    }

    console.log('🔍 GSC Comparison Table - Processing API data:', {
      currentPeriod: `${sectionFilters.dateRange.startDate} to ${sectionFilters.dateRange.endDate}`,
      comparisonPeriod: `${sectionFilters.comparisonDateRange.startDate} to ${sectionFilters.comparisonDateRange.endDate}`,
      primaryDataCount: data.length,
      comparisonDataCount: comparisonData.length,
      samplePrimaryData: data.slice(0, 3).map(item => ({
        date: item.date,
        query: item.query?.substring(0, 20),
        page: item.page?.substring(0, 30),
        clicks: item.clicks
      })),
      sampleComparisonData: comparisonData.slice(0, 3).map(item => ({
        date: item.date,
        query: item.query?.substring(0, 20),
        page: item.page?.substring(0, 30),
        clicks: item.clicks
      }))
    });

    if (!hasValidData) {
      console.log('🔍 GSC Comparison - No valid data:', {
        primaryDataCount: data?.length || 0,
        comparisonDataCount: comparisonData?.length || 0
      });
      return [];
    }

    // Group current period data by query-url combination (normalized format)
    const currentGroups = new Map<string, {
      query: string;
      url: string; // From normalized data
      clicks: number;
      impressions: number;
      positions: { position: number; impressions: number }[];
    }>();

    data.forEach(item => {
      if (!item.query) return;
      
      const key = `${item.query}-${item.url || ''}`;
      
      if (!currentGroups.has(key)) {
        currentGroups.set(key, {
          query: item.query,
          url: item.url || '', // Use normalized 'url' field
          clicks: 0,
          impressions: 0,
          positions: []
        });
      }
      
      const group = currentGroups.get(key)!;
      group.clicks += item.clicks || 0;
      group.impressions += item.impressions || 0;
      
      if (item.position && item.impressions) {
        group.positions.push({
          position: item.position,
          impressions: item.impressions
        });
      }
    });

    console.log('🔍 GSC Comparison - Current groups created:', {
      groupCount: currentGroups.size,
      firstFewGroups: Array.from(currentGroups.entries()).slice(0, 3).map(([key, group]) => ({
        key,
        query: group.query,
        url: group.url,
        clicks: group.clicks,
        impressions: group.impressions
      }))
    });

    // Group comparison period data by query-url combination (normalized format)
    const comparisonGroups = new Map<string, {
      query: string;
      url: string; // From normalized data
      clicks: number;
      impressions: number;
      positions: { position: number; impressions: number }[];
    }>();

    comparisonData.forEach(item => {
      if (!item.query) return;
      
      const key = `${item.query}-${item.url || ''}`;
      
      if (!comparisonGroups.has(key)) {
        comparisonGroups.set(key, {
          query: item.query,
          url: item.url || '', // Use normalized 'url' field
          clicks: 0,
          impressions: 0,
          positions: []
        });
      }
      
      const group = comparisonGroups.get(key)!;
      group.clicks += item.clicks || 0;
      group.impressions += item.impressions || 0;
      
      if (item.position && item.impressions) {
        group.positions.push({
          position: item.position,
          impressions: item.impressions
        });
      }
    });

    console.log('🔍 GSC Comparison - Comparison groups created:', {
      groupCount: comparisonGroups.size,
      firstFewGroups: Array.from(comparisonGroups.entries()).slice(0, 3).map(([key, group]) => ({
        key,
        query: group.query,
        url: group.url,
        clicks: group.clicks,
        impressions: group.impressions
      }))
    });

    // Combine current and comparison data
    const allKeys = new Set([...currentGroups.keys(), ...comparisonGroups.keys()]);
    console.log('🔍 GSC Comparison - All keys combined:', {
      totalKeys: allKeys.size,
      firstFewKeys: Array.from(allKeys).slice(0, 5)
    });
    
    const tableRows: GSCComparisonTableRow[] = Array.from(allKeys).map(key => {
      const currentGroup = currentGroups.get(key);
      const comparisonGroup = comparisonGroups.get(key);
      
      // Calculate current period metrics
      const clicksCurrent = currentGroup?.clicks || 0;
      const impressionsCurrent = currentGroup?.impressions || 0;
      const ctrCurrent = impressionsCurrent > 0 ? (clicksCurrent / impressionsCurrent) * 100 : 0;
      
      // Calculate current period average position (GSC methodology)
      let avgPositionCurrent = 0;
      if (currentGroup?.positions.length) {
        let totalImpressionPositions = 0;
        let totalImpressions = 0;
        
        currentGroup.positions.forEach(({ position, impressions }) => {
          totalImpressionPositions += position * impressions;
          totalImpressions += impressions;
        });
        
        avgPositionCurrent = totalImpressions > 0 ? totalImpressionPositions / totalImpressions : 0;
      }
      
      // Calculate comparison period metrics
      const clicksPrevious = comparisonGroup?.clicks || 0;
      const impressionsPrevious = comparisonGroup?.impressions || 0;
      const ctrPrevious = impressionsPrevious > 0 ? (clicksPrevious / impressionsPrevious) * 100 : 0;
      
      // Calculate comparison period average position (GSC methodology)
      let avgPositionPrevious = 0;
      if (comparisonGroup?.positions.length) {
        let totalImpressionPositions = 0;
        let totalImpressions = 0;
        
        comparisonGroup.positions.forEach(({ position, impressions }) => {
          totalImpressionPositions += position * impressions;
          totalImpressions += impressions;
        });
        
        avgPositionPrevious = totalImpressions > 0 ? totalImpressionPositions / totalImpressions : 0;
      }
      
      // Calculate changes and percentages
      const clicksChange = clicksCurrent - clicksPrevious;
      const clicksChangePercent = clicksPrevious > 0 ? (clicksChange / clicksPrevious) * 100 : 0;
      
      const impressionsChange = impressionsCurrent - impressionsPrevious;
      const impressionsChangePercent = impressionsPrevious > 0 ? (impressionsChange / impressionsPrevious) * 100 : 0;
      
      const ctrChange = ctrCurrent - ctrPrevious;
      const ctrChangePercent = ctrPrevious > 0 ? (ctrChange / ctrPrevious) * 100 : 0;
      
      const avgPositionChange = avgPositionCurrent - avgPositionPrevious;
      const avgPositionChangePercent = avgPositionPrevious > 0 ? (avgPositionChange / avgPositionPrevious) * 100 : 0;
      
      return {
        query: currentGroup?.query || comparisonGroup?.query || '',
        url: currentGroup?.url || comparisonGroup?.url || '',
        clicksCurrent,
        impressionsCurrent,
        ctrCurrent,
        avgPositionCurrent,
        clicksPrevious,
        impressionsPrevious,
        ctrPrevious,
        avgPositionPrevious,
        clicksChange,
        clicksChangePercent,
        impressionsChange,
        impressionsChangePercent,
        ctrChange,
        ctrChangePercent,
        avgPositionChange,
        avgPositionChangePercent,
      };
    });

    console.log('🔍 GSC Comparison Table processed:', {
      inputPrimaryRows: data.length,
      inputComparisonRows: comparisonData.length,
      outputRows: tableRows.length,
      sampleOutput: tableRows.slice(0, 2)
    });

        return tableRows;
  }, [data, comparisonData, sectionFilters.enableComparison, sectionFilters.comparisonDateRange]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = processedData;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        row.query.toLowerCase().includes(term) ||
        row.url.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        return 0;
      });
    }

    console.log('🔍 GSC Comparison - After filtering/sorting:', {
      processedDataCount: processedData.length,
      searchTerm,
      filteredCount: filtered.length,
      sortField,
      sortDirection
    });

    return filtered;
  }, [processedData, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + rowsPerPage);

  console.log('🔍 GSC Comparison - Final pagination:', {
    totalItems: filteredAndSortedData.length,
    totalPages,
    currentPage,
    rowsPerPage,
    startIndex,
    paginatedDataCount: paginatedData.length,
    samplePaginatedData: paginatedData.slice(0, 2).map(row => ({
      query: row.query,
      clicks: row.clicksCurrent,
      impressions: row.impressionsCurrent
    }))
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => 
        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
      );
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleExport = () => {
    const exportData = filteredAndSortedData.map(row => ({
      Query: row.query,
      URL: row.url,
      'Clicks (Current)': row.clicksCurrent,
      'Clicks (Previous)': row.clicksPrevious,
      'Clicks Change': row.clicksChange,
      'Clicks Change %': row.clicksChangePercent.toFixed(2),
      'Impressions (Current)': row.impressionsCurrent,
      'Impressions (Previous)': row.impressionsPrevious,
      'Impressions Change': row.impressionsChange,
      'Impressions Change %': row.impressionsChangePercent.toFixed(2),
      'CTR (Current)': row.ctrCurrent.toFixed(2),
      'CTR (Previous)': row.ctrPrevious.toFixed(2),
      'CTR Change': row.ctrChange.toFixed(2),
      'CTR Change %': row.ctrChangePercent.toFixed(2),
      'Avg Position (Current)': row.avgPositionCurrent.toFixed(1),
      'Avg Position (Previous)': row.avgPositionPrevious.toFixed(1),
      'Avg Position Change': row.avgPositionChange.toFixed(1),
      'Avg Position Change %': row.avgPositionChangePercent.toFixed(2),
    }));

    // Create CSV content
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gsc-comparison-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4" />;
  };

  const ChangeIndicator = ({ value, showIcon = true }: { value: number; showIcon?: boolean }) => {
    const isPositive = value > 0;
    const isNegative = value < 0;
    
    return (
      <span className={`flex items-center space-x-1 ${
        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
      }`}>
        {showIcon && (
          <>
            {isPositive && <TrendingUp className="h-3 w-3" />}
            {isNegative && <TrendingDown className="h-3 w-3" />}
          </>
        )}
        <span>{isPositive ? '+' : ''}{value.toFixed(0)}%</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="text-red-600 font-medium mb-2">Failed to load GSC comparison data</div>
          <div className="text-sm text-gray-500">{error}</div>
        </div>
      </div>
    );
  }

  if (!sectionFilters.enableComparison) {
    return (
      <div className="text-center py-8 text-gray-500">
        Enable comparison mode to view comparison data
      </div>
    );
  }

  if (!hasValidData) {
    return (
      <div className="text-center py-8 text-amber-600">
        <div className="font-medium mb-2">No comparison data available</div>
        <div className="text-sm text-gray-500">
          Primary data: {data?.length || 0} rows, Comparison data: {comparisonData?.length || 0} rows
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Export */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search queries or URLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleExport} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Comparison Period Info */}
      {sectionFilters.comparisonPreset && (
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
          <strong>Comparison:</strong> {sectionFilters.comparisonPreset.replace(/_/g, ' ').replace('last ', '').replace(' vs previous', ' vs previous period')}
          <br />
          <strong>Current:</strong> {sectionFilters.dateRange.startDate} to {sectionFilters.dateRange.endDate}
          <br />
          <strong>Previous:</strong> {sectionFilters.comparisonDateRange?.startDate} to {sectionFilters.comparisonDateRange?.endDate}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="border-r">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('query')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Query
                  <SortIcon field="query" />
                </Button>
              </TableHead>
              <TableHead rowSpan={2} className="border-r w-[150px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('url')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  URL
                  <SortIcon field="url" />
                </Button>
              </TableHead>
              <TableHead colSpan={3} className="text-center border-r bg-blue-50 dark:bg-blue-950/20">
                Clicks
              </TableHead>
              <TableHead colSpan={3} className="text-center border-r bg-green-50 dark:bg-green-950/20">
                Impressions
              </TableHead>
              <TableHead colSpan={3} className="text-center border-r bg-yellow-50 dark:bg-yellow-950/20">
                CTR (%)
              </TableHead>
              <TableHead colSpan={3} className="text-center bg-purple-50 dark:bg-purple-950/20">
                Avg Position
              </TableHead>
            </TableRow>
            <TableRow>
              {/* Clicks */}
              <TableHead className="text-right text-xs bg-blue-25 dark:bg-blue-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('clicksCurrent')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  Current
                  <SortIcon field="clicksCurrent" />
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-blue-25 dark:bg-blue-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('clicksPrevious')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  Previous
                  <SortIcon field="clicksPrevious" />
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs border-r bg-blue-25 dark:bg-blue-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('clicksChangePercent')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  % Change
                  <SortIcon field="clicksChangePercent" />
                </Button>
              </TableHead>
              {/* Impressions */}
              <TableHead className="text-right text-xs bg-green-25 dark:bg-green-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('impressionsCurrent')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  Current
                  <SortIcon field="impressionsCurrent" />
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-green-25 dark:bg-green-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('impressionsPrevious')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  Previous
                  <SortIcon field="impressionsPrevious" />
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs border-r bg-green-25 dark:bg-green-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('impressionsChangePercent')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  % Change
                  <SortIcon field="impressionsChangePercent" />
                </Button>
              </TableHead>
              {/* CTR */}
              <TableHead className="text-right text-xs bg-yellow-25 dark:bg-yellow-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('ctrCurrent')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  Current
                  <SortIcon field="ctrCurrent" />
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-yellow-25 dark:bg-yellow-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('ctrPrevious')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  Previous
                  <SortIcon field="ctrPrevious" />
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs border-r bg-yellow-25 dark:bg-yellow-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('ctrChangePercent')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  % Change
                  <SortIcon field="ctrChangePercent" />
                </Button>
              </TableHead>
              {/* Position */}
              <TableHead className="text-right text-xs bg-purple-25 dark:bg-purple-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('avgPositionCurrent')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  Current
                  <SortIcon field="avgPositionCurrent" />
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-purple-25 dark:bg-purple-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('avgPositionPrevious')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  Previous
                  <SortIcon field="avgPositionPrevious" />
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-purple-25 dark:bg-purple-900/10">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('avgPositionChangePercent')}
                  className="h-auto p-0 text-xs hover:bg-transparent"
                >
                  % Change
                  <SortIcon field="avgPositionChangePercent" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              console.log('🔍 GSC Comparison - JSX Render Check:', {
                paginatedDataLength: paginatedData.length,
                isEmpty: paginatedData.length === 0,
                firstRow: paginatedData[0] ? {
                  query: paginatedData[0].query,
                  clicks: paginatedData[0].clicksCurrent
                } : null
              });
              return paginatedData.length === 0;
            })() ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-gray-500">
                  No comparison data found for the selected period
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => {
                if (index < 3) { // Only log first 3 rows to avoid spam
                  console.log(`🔍 GSC Comparison - Rendering row ${index}:`, {
                    query: row.query,
                    url: row.url,
                    clicksCurrent: row.clicksCurrent,
                    impressionsCurrent: row.impressionsCurrent
                  });
                }
                return (
                <TableRow key={`${row.query}-${row.url}-${index}`}>
                  <TableCell className="font-medium max-w-xs border-r">
                    <div className="truncate" title={row.query}>
                      {row.query}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[150px] border-r">
                    {row.url ? (
                      <div className="flex items-center space-x-2">
                        <div className="truncate flex-1" title={row.url}>
                          {row.url}
                        </div>
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  {/* Clicks */}
                  <TableCell className="text-right font-mono text-xs">{row.clicksCurrent.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{row.clicksPrevious.toLocaleString()}</TableCell>
                  <TableCell className="text-right border-r">
                    <ChangeIndicator value={row.clicksChangePercent} />
                  </TableCell>
                  {/* Impressions */}
                  <TableCell className="text-right font-mono text-xs">{row.impressionsCurrent.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{row.impressionsPrevious.toLocaleString()}</TableCell>
                  <TableCell className="text-right border-r">
                    <ChangeIndicator value={row.impressionsChangePercent} />
                  </TableCell>
                  {/* CTR */}
                  <TableCell className="text-right font-mono text-xs">{row.ctrCurrent.toFixed(0)}%</TableCell>
                  <TableCell className="text-right font-mono text-xs">{row.ctrPrevious.toFixed(0)}%</TableCell>
                  <TableCell className="text-right border-r">
                    <ChangeIndicator value={row.ctrChangePercent} />
                  </TableCell>
                  {/* Position */}
                  <TableCell className="text-right font-mono text-xs">{row.avgPositionCurrent.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{row.avgPositionPrevious.toFixed(1)}</TableCell>
                  <TableCell className="text-right">
                    <ChangeIndicator value={row.avgPositionChangePercent} />
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
