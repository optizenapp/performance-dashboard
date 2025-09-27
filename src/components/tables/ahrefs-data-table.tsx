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
import { Badge } from '@/components/ui/badge';
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

interface AhrefsTableRow {
  keyword: string;
  serpFeatures: string;
  volume: number;
  kd: number;
  currentOrganicTraffic: number;
  currentPosition: number;
  currentUrl: string;
  dateCrawled: string;
  daysAgo: number; // Days since last update
}

interface AhrefsDataTableProps {
  data: NormalizedMetric[];
  loading?: boolean;
  sectionFilters: SectionFilters;
}

type SortField = keyof AhrefsTableRow;
type SortDirection = 'asc' | 'desc' | null;

export function AhrefsDataTable({
  data,
  loading = false,
  sectionFilters,
}: AhrefsDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('currentOrganicTraffic');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50);

  // Process Ahrefs data into table rows
  const processedData = useMemo(() => {
    const today = new Date();
    
    // Date analysis for debugging (can be removed later)
    const dateAnalysis = {
      totalItems: data.length,
      itemsWithDates: data.filter(item => item.date && item.date.trim() !== '').length,
      itemsWithoutDates: data.filter(item => !item.date || item.date.trim() === '').length,
      datePercentage: Math.round((data.filter(item => item.date && item.date.trim() !== '').length / data.length) * 100)
    };
    
    console.log('📊 Ahrefs Date Coverage:', `${dateAnalysis.itemsWithDates}/${dateAnalysis.totalItems} rows (${dateAnalysis.datePercentage}%) have dates`);

    // No date range filtering for non-comparison table - show all data
    // Calculate days ago for each item
    const dataWithDaysAgo = data.map(item => {
      if (!item.date || item.date.trim() === '') {
        return {
          ...item,
          daysAgo: 0 // No date = no calculation
        };
      }
      
      const itemDate = new Date(item.date);
      // Check if date is valid
      if (isNaN(itemDate.getTime())) {
        return {
          ...item,
          daysAgo: 0 // Invalid date = no calculation
        };
      }
      
      const diffTime = today.getTime() - itemDate.getTime();
      const daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...item,
        daysAgo: Math.max(0, daysAgo) // Ensure non-negative
      };
    });

    // Apply "Last Updated" filter if specified
    const lastUpdatedFilter = sectionFilters.ahrefsLastUpdatedFilter || 'all';
    const filteredData = dataWithDaysAgo.filter(item => {
      switch (lastUpdatedFilter) {
        case 'last_5_days':
          return item.daysAgo <= 5;
        case 'last_6_10_days':
          return item.daysAgo >= 6 && item.daysAgo <= 10;
        case 'last_11_20_days':
          return item.daysAgo >= 11 && item.daysAgo <= 20;
        case 'last_21_plus_days':
          return item.daysAgo >= 21;
        case 'all':
        default:
          return true;
      }
    });

    // Group by keyword and get the most recent data for each
    const keywordGroups = new Map<string, NormalizedMetric>();

    filteredData.forEach(item => {
      if (!item.query) return;
      
      const key = `${item.query}-${item.serpFeatures || ''}`;
      const existing = keywordGroups.get(key);
      
      // Keep the most recent entry for each keyword
      if (!existing || new Date(item.date) > new Date(existing.date)) {
        keywordGroups.set(key, item);
      }
    });

    // Convert to table rows
    const tableRows: AhrefsTableRow[] = Array.from(keywordGroups.values()).map(item => {
      // Convert the ISO date back to the original format (DD/M/YYYY) without time
      let displayDate = '';
      
      if (item.date && item.date.trim() !== '') {
        try {
          const date = new Date(item.date);
          if (!isNaN(date.getTime())) {
            displayDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          // Don't use fallback, leave empty for invalid dates
          displayDate = '';
        }
      }
      
      return {
        keyword: item.query || '',
        serpFeatures: item.serpFeatures || '',
        volume: item.volume || 0,
        kd: item.difficulty || 0, // Map difficulty to kd (keyword difficulty)
        currentOrganicTraffic: item.traffic || 0, // Map traffic to currentOrganicTraffic
        currentPosition: item.position || 0, // Map position to currentPosition
        currentUrl: item.url || '', // Map url to currentUrl
        dateCrawled: displayDate,
        daysAgo: (item as any).daysAgo || 0 // Days since last update
      };
    });

    // Final date statistics
    const finalStats = {
      totalRows: tableRows.length,
      rowsWithDates: tableRows.filter(row => row.dateCrawled !== '').length,
      finalPercentage: Math.round((tableRows.filter(row => row.dateCrawled !== '').length / tableRows.length) * 100)
    };

    console.log('✅ Final Date Coverage:', `${finalStats.rowsWithDates}/${finalStats.totalRows} table rows (${finalStats.finalPercentage}%) have Date Crawled populated`);

    return tableRows;
  }, [data, sectionFilters.ahrefsLastUpdatedFilter]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = processedData;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        row.keyword.toLowerCase().includes(term) ||
        row.currentUrl.toLowerCase().includes(term) ||
        row.serpFeatures.toLowerCase().includes(term)
      );
    }

    // Apply sorting (global sorting across all pages)
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
      
      console.log('🔄 Ahrefs Data Global Sort:', {
        totalRows: filtered.length,
        sortField,
        sortDirection,
        firstRowAfterSort: filtered[0]?.[sortField],
        lastRowAfterSort: filtered[filtered.length - 1]?.[sortField]
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
      Keyword: row.keyword,
      'SERP Features': row.serpFeatures,
      Volume: row.volume,
      KD: row.kd,
      'Current Organic Traffic': row.currentOrganicTraffic,
      'Current Position': row.currentPosition,
      'Current URL': row.currentUrl
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
    a.download = 'ahrefs-performance-data.csv';
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

  return (
    <div className="space-y-4">
      {/* Search and Export */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search keywords or URLs..."
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

      {/* Info note about Date Crawled */}
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
        <span className="font-medium">Note:</span> If Date Crawled is blank, the crawled date was not included in the Ahrefs import.
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('keyword')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Keyword
                  <SortIcon field="keyword" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('currentUrl')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Current URL
                  <SortIcon field="currentUrl" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('volume')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Volume
                  <SortIcon field="volume" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('dateCrawled')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Date Crawled
                  <SortIcon field="dateCrawled" />
                </Button>
              </TableHead>
              <TableHead className="w-[200px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('serpFeatures')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  SERP Features
                  <SortIcon field="serpFeatures" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('kd')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  KD
                  <SortIcon field="kd" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('currentOrganicTraffic')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Current Organic Traffic
                  <SortIcon field="currentOrganicTraffic" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('currentPosition')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Current Position
                  <SortIcon field="currentPosition" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No Ahrefs data found for the selected date range
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow key={`${row.keyword}-${row.serpFeatures}-${index}`}>
                  {/* 1. Keyword */}
                  <TableCell className="font-medium max-w-xs">
                    <div className="truncate" title={row.keyword}>
                      {row.keyword}
                    </div>
                  </TableCell>
                  {/* 2. Current URL */}
                  <TableCell className="max-w-xs">
                    {row.currentUrl ? (
                      <div className="flex items-center space-x-2">
                        <div className="truncate" title={row.currentUrl}>
                          {row.currentUrl}
                        </div>
                        <a
                          href={row.currentUrl}
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
                  {/* 3. Volume */}
                  <TableCell className="text-right font-mono">
                    {row.volume > 0 ? row.volume.toLocaleString() : '-'}
                  </TableCell>
                  {/* 4. Date Crawled */}
                  <TableCell className="text-sm text-gray-600">
                    {row.dateCrawled ? (
                      <div className="flex flex-col">
                        <span>{row.dateCrawled}</span>
                        <span className="text-xs text-gray-400">
                          {row.daysAgo === 0 ? '' : 
                           row.daysAgo === 1 ? '1 day ago' : 
                           `${row.daysAgo} days ago`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  {/* 5. SERP Features */}
                  <TableCell className="w-[200px] max-w-[200px]">
                    {row.serpFeatures ? (
                      <div className="text-xs text-gray-700 dark:text-gray-300 leading-tight" title={row.serpFeatures}>
                        <span className="line-clamp-2 break-words">{row.serpFeatures}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  {/* 6. KD */}
                  <TableCell className="text-right font-mono">
                    {row.kd > 0 ? row.kd.toString() : '-'}
                  </TableCell>
                  {/* 7. Current Organic Traffic */}
                  <TableCell className="text-right font-mono">
                    {row.currentOrganicTraffic > 0 ? row.currentOrganicTraffic.toLocaleString() : '-'}
                  </TableCell>
                  {/* 8. Current Position */}
                  <TableCell className="text-right font-mono">
                    {row.currentPosition > 0 ? row.currentPosition.toFixed(1) : '-'}
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
