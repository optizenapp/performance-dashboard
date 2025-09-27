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
  ExternalLink
} from 'lucide-react';
import { NormalizedMetric, SectionFilters } from '@/lib/types';
import { exportToCSV } from '@/lib/data-utils';

interface GSCTableRow {
  query: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  date: string;
}

interface GSCDataTableProps {
  data: any[]; // NEW: GSC API data format
  loading?: boolean;
  error?: string | null;
  sectionFilters: SectionFilters;
}

type SortField = keyof GSCTableRow;
type SortDirection = 'asc' | 'desc' | null;

export function GSCDataTable({
  data,
  loading = false,
  error = null,
  sectionFilters,
}: GSCDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('clicks');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50);

  // Process GSC API data into table rows
  const processedData = useMemo(() => {
    console.log('🔍 GSCDataTable processing GSC API data:', {
      inputDataCount: data.length,
      firstItem: data[0],
      firstItemPage: data[0]?.page,
      firstItemPageType: typeof data[0]?.page,
      allKeys: Object.keys(data[0] || {}),
    });
    
    // Log first 3 items individually
    data.slice(0, 3).forEach((item, index) => {
      console.log(`🔍 GSC Item ${index}:`, {
        query: item.query,
        page: item.page,
        url: item.url,  // Check if there's a url field too
        pageExists: !!item.page,
        allFields: Object.keys(item)
      });
    });

    if (!data || data.length === 0) {
      console.log('🔍 GSCDataTable: No data provided');
      return [];
    }

    // Normalized GSC data format: { query, url, clicks, impressions, ctr, position, date }
    // Group by query-url combination and aggregate metrics
    const queryGroups = new Map<string, {
      query: string;
      url: string;
      clicks: number;
      impressions: number;
      positions: { position: number; impressions: number }[];
      dates: string[];
    }>();

    data.forEach(item => {
      // Skip if no query (should not happen with GSC API)
      if (!item.query) return;
      
      const key = `${item.query}-${item.url || ''}`;
      
      if (!queryGroups.has(key)) {
        queryGroups.set(key, {
          query: item.query,
          url: item.url || '', // Use normalized 'url' field
          clicks: 0,
          impressions: 0,
          positions: [],
          dates: []
        });
      }
      
      const group = queryGroups.get(key)!;
      group.clicks += item.clicks || 0;
      group.impressions += item.impressions || 0;
      
      if (item.position && item.impressions) {
        group.positions.push({
          position: item.position,
          impressions: item.impressions
        });
      }
      
      if (item.date && !group.dates.includes(item.date)) {
        group.dates.push(item.date);
      }
    });

    // Convert to table rows
    const tableRows: GSCTableRow[] = Array.from(queryGroups.values()).map(group => {
      // Calculate weighted average position (GSC methodology)
      let totalImpressionPositions = 0;
      let totalImpressions = 0;
      
      group.positions.forEach(({ position, impressions }) => {
        totalImpressionPositions += position * impressions;
        totalImpressions += impressions;
      });
      
      const avgPosition = totalImpressions > 0 ? totalImpressionPositions / totalImpressions : 0;
      const ctr = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
      
      return {
        query: group.query,
        url: group.url,
        clicks: group.clicks,
        impressions: group.impressions,
        ctr,
        avgPosition,
        date: group.dates.sort().pop() || '' // Most recent date
      };
    });

    console.log('🔍 GSCDataTable processed:', {
      inputRows: data.length,
      outputRows: tableRows.length,
    });
    
    // Log first 3 output rows individually
    tableRows.slice(0, 3).forEach((row, index) => {
      console.log(`🔍 Final Row ${index}:`, {
        query: row.query,
        url: row.url,
        urlExists: !!row.url,
        urlLength: row.url?.length,
        clicks: row.clicks
      });
    });

    return tableRows;
  }, [data]);

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

    return filtered;
  }, [processedData, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + rowsPerPage);

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
      Clicks: row.clicks,
      Impressions: row.impressions,
      'CTR (%)': row.ctr.toFixed(2),
      'Avg Position': row.avgPosition.toFixed(2)
    }));

    // Generate CSV content
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gsc-performance-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4" />;
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
          <div className="text-red-600 font-medium mb-2">Failed to load GSC data</div>
          <div className="text-sm text-gray-500">{error}</div>
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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('query')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Query
                  <SortIcon field="query" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('url')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  URL
                  <SortIcon field="url" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('clicks')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Clicks
                  <SortIcon field="clicks" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('impressions')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Impressions
                  <SortIcon field="impressions" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('ctr')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  CTR (%)
                  <SortIcon field="ctr" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('avgPosition')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Avg Position
                  <SortIcon field="avgPosition" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No GSC data found for the selected date range
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow key={`${row.query}-${row.url}-${index}`}>
                  <TableCell className="font-medium max-w-xs">
                    <div className="truncate" title={row.query}>
                      {row.query}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {row.url ? (
                      <div className="flex items-center space-x-2">
                        <div className="truncate" title={row.url}>
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
                  <TableCell className="text-right font-mono">
                    {row.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.ctr.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.avgPosition.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))
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
