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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { TableRow as TableRowType } from '@/lib/types';
import { formatMetricValue, exportToCSV } from '@/lib/data-utils';
import { cn } from '@/lib/utils';

interface ComparisonDataTableProps {
  data: TableRowType[];
  title?: string;
  description?: string;
  loading?: boolean;
  onExport?: (format: 'csv' | 'json') => void;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
}

type SortField = keyof TableRowType | 'clicksFirst' | 'clicksLast' | 'clicksChangeValue' | 'impressionsFirst' | 'impressionsLast' | 'impressionsChangeValue' | 'ctrFirst' | 'ctrLast' | 'ctrChangeValue' | 'positionFirst' | 'positionLast' | 'positionChangeValue' | 'trafficFirst' | 'trafficLast' | 'trafficChangeValue';
type SortDirection = 'asc' | 'desc' | null;

export function ComparisonDataTable({
  data,
  title = 'Performance Data - Comparison',
  description = 'Compare metrics across different time periods',
  loading = false,
  onExport,
  comparisonStartDate,
  comparisonEndDate,
}: ComparisonDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('clicksLast');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchTerm) {
      filtered = data.filter(row => 
        row.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (row.url && row.url.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply sorting
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        // Handle the new comparison fields that might not be directly on the TableRow type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let aVal: any, bVal: any;
        
        if (sortField in a) {
          aVal = a[sortField as keyof TableRowType];
          bVal = b[sortField as keyof TableRowType];
        } else {
          // Handle the extended comparison fields
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          aVal = (a as any)[sortField];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          bVal = (b as any)[sortField];
        }
        
        if (aVal === undefined && bVal === undefined) return 0;
        if (aVal === undefined) return 1;
        if (bVal === undefined) return -1;
        
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / rowsPerPage);
  const paginatedData = processedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(
        sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortField('clicksLast'); // Default sort
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-3 w-3 ml-1" />;
    }
    return <ArrowUpDown className="h-3 w-3 ml-1" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-3 w-3" />;
    if (change < 0) return <TrendingDown className="h-3 w-3" />;
    return null;
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      const csvContent = exportToCSV(processedData);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seo-metrics-comparison-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const jsonContent = JSON.stringify(processedData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seo-metrics-comparison-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    if (onExport) {
      onExport(format);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {description} • {processedData.length} results
            </CardDescription>
            {comparisonStartDate && comparisonEndDate && (
              <div className="mt-2 text-sm text-blue-600 font-medium">
                Comparison Period: {new Date(comparisonStartDate).toLocaleDateString()} - {new Date(comparisonEndDate).toLocaleDateString()}
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
            >
              <Download className="h-4 w-4 mr-1" />
              JSON
            </Button>
          </div>
        </div>
        
        {/* Search and Pagination Controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search queries or URLs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Rows per page:</label>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1); // Reset to first page
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('query')}
                    className="h-auto p-0 font-semibold"
                  >
                    Query
                    {getSortIcon('query')}
                  </Button>
                </TableHead>
                <TableHead className="w-[150px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('url')}
                    className="h-auto p-0 font-semibold"
                  >
                    URL
                    {getSortIcon('url')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('serpFeatures')}
                    className="h-auto p-0 font-semibold"
                  >
                    SERP Features
                    {getSortIcon('serpFeatures')}
                  </Button>
                </TableHead>

                {/* GSC Metrics - Clicks */}
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('clicksFirst')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Clicks First Date
                    {getSortIcon('clicksFirst')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('clicksLast')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Clicks Last Date
                    {getSortIcon('clicksLast')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('clicksChangeValue')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Clicks Change
                    {getSortIcon('clicksChangeValue')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('clicksChange')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Clicks % Change
                    {getSortIcon('clicksChange')}
                  </Button>
                </TableHead>

                {/* GSC Metrics - Impressions */}
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('impressionsFirst')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Impressions First Date
                    {getSortIcon('impressionsFirst')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('impressionsLast')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Impressions Last Date
                    {getSortIcon('impressionsLast')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('impressionsChangeValue')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Impressions Change
                    {getSortIcon('impressionsChangeValue')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('impressionsChange')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Impressions % Change
                    {getSortIcon('impressionsChange')}
                  </Button>
                </TableHead>

                {/* GSC Metrics - CTR */}
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('ctrFirst')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    CTR First Date
                    {getSortIcon('ctrFirst')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('ctrLast')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    CTR Last Date
                    {getSortIcon('ctrLast')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('ctrChangeValue')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    CTR Change
                    {getSortIcon('ctrChangeValue')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-blue-50 dark:bg-blue-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('ctrChange')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    CTR % Change
                    {getSortIcon('ctrChange')}
                  </Button>
                </TableHead>

                {/* Ahrefs Metrics - Position */}
                <TableHead className="text-center bg-orange-50 dark:bg-orange-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('positionFirst')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Position First Date
                    {getSortIcon('positionFirst')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-orange-50 dark:bg-orange-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('positionLast')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Position Last Date
                    {getSortIcon('positionLast')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-orange-50 dark:bg-orange-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('positionChangeValue')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Position Change
                    {getSortIcon('positionChangeValue')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-orange-50 dark:bg-orange-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('positionChange')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Position % Change
                    {getSortIcon('positionChange')}
                  </Button>
                </TableHead>

                {/* Ahrefs Metrics - Traffic */}
                <TableHead className="text-center bg-orange-50 dark:bg-orange-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('trafficFirst')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Traffic First Date
                    {getSortIcon('trafficFirst')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-orange-50 dark:bg-orange-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('trafficLast')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Traffic Last Date
                    {getSortIcon('trafficLast')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-orange-50 dark:bg-orange-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('trafficChangeValue')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Traffic Change
                    {getSortIcon('trafficChangeValue')}
                  </Button>
                </TableHead>
                <TableHead className="text-center bg-orange-50 dark:bg-orange-900/20 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('change')}
                    className="h-auto p-0 font-semibold text-xs"
                  >
                    Traffic % Change
                    {getSortIcon('change')}
                  </Button>
                </TableHead>

                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('volume')}
                    className="h-auto p-0 font-semibold"
                  >
                    Volume
                    {getSortIcon('volume')}
                  </Button>
                </TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, index) => (
                <TableRow key={`${row.query}-${index}`}>
                  <TableCell className="font-medium">
                    {row.query}
                  </TableCell>
                  <TableCell className="w-[150px] relative group">
                    {row.url ? (
                      <div className="relative">
                        <div className="flex items-center space-x-1 text-sm">
                          <ExternalLink className="h-3 w-3 text-gray-400" />
                          <span className="truncate text-blue-600">
                            {row.url.replace(/^https?:\/\//, '').split('/')[0]}
                          </span>
                        </div>
                        
                        {/* Hover tooltip with full clickable URL */}
                        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 z-50 min-w-[300px] max-w-[500px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Full URL:</div>
                          <a
                            href={row.url.startsWith('http') ? row.url : `https://${row.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.url}
                          </a>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {row.serpFeatures ? (
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="truncate block" title={row.serpFeatures}>
                          {row.serpFeatures}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>

                  {/* GSC Metrics - Clicks */}
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).clicksFirst !== undefined ? formatMetricValue((row as any).clicksFirst, 'clicks') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).clicksLast !== undefined ? formatMetricValue((row as any).clicksLast, 'clicks') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).clicksChangeValue !== undefined ? 
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      `${(row as any).clicksChangeValue > 0 ? '+' : ''}${(row as any).clicksChangeValue}` : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.clicksChange !== undefined ? (
                      <div className={cn('flex items-center space-x-1', getChangeColor(row.clicksChange))}>
                        {getChangeIcon(row.clicksChange)}
                        <span className="text-sm font-medium">
                          {row.clicksChange > 0 ? '+' : ''}{row.clicksChange}%
                        </span>
                      </div>
                    ) : '-'}
                  </TableCell>

                  {/* GSC Metrics - Impressions */}
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).impressionsFirst !== undefined ? formatMetricValue((row as any).impressionsFirst, 'impressions') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).impressionsLast !== undefined ? formatMetricValue((row as any).impressionsLast, 'impressions') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).impressionsChangeValue !== undefined ? 
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      `${(row as any).impressionsChangeValue > 0 ? '+' : ''}${(row as any).impressionsChangeValue}` : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.impressionsChange !== undefined ? (
                      <div className={cn('flex items-center space-x-1', getChangeColor(row.impressionsChange))}>
                        {getChangeIcon(row.impressionsChange)}
                        <span className="text-sm font-medium">
                          {row.impressionsChange > 0 ? '+' : ''}{row.impressionsChange}%
                        </span>
                      </div>
                    ) : '-'}
                  </TableCell>

                  {/* GSC Metrics - CTR */}
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).ctrFirst !== undefined ? formatMetricValue((row as any).ctrFirst, 'ctr') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).ctrLast !== undefined ? formatMetricValue((row as any).ctrLast, 'ctr') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).ctrChangeValue !== undefined ? 
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      `${(row as any).ctrChangeValue > 0 ? '+' : ''}${(row as any).ctrChangeValue.toFixed(2)}%` : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.ctrChange !== undefined ? (
                      <div className={cn('flex items-center space-x-1', getChangeColor(row.ctrChange))}>
                        {getChangeIcon(row.ctrChange)}
                        <span className="text-sm font-medium">
                          {row.ctrChange > 0 ? '+' : ''}{row.ctrChange}%
                        </span>
                      </div>
                    ) : '-'}
                  </TableCell>

                  {/* Ahrefs Metrics - Position */}
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).positionFirst !== undefined ? formatMetricValue((row as any).positionFirst, 'position') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).positionLast !== undefined ? formatMetricValue((row as any).positionLast, 'position') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).positionChangeValue !== undefined ? 
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      `${(row as any).positionChangeValue > 0 ? '-' : '+'}${Math.abs((row as any).positionChangeValue).toFixed(1)}` : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.positionChange !== undefined ? (
                      <div className={cn('flex items-center space-x-1', getChangeColor(-row.positionChange))}>
                        {getChangeIcon(-row.positionChange)}
                        <span className="text-sm font-medium">
                          {/* For position: negative change is good (going from 10 to 5), positive change is bad (going from 5 to 10) */}
                          {row.positionChange > 0 ? '-' : '+'}{Math.abs(row.positionChange)}%
                        </span>
                      </div>
                    ) : '-'}
                  </TableCell>

                  {/* Ahrefs Metrics - Traffic */}
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).trafficFirst !== undefined ? formatMetricValue((row as any).trafficFirst, 'traffic') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).trafficLast !== undefined ? formatMetricValue((row as any).trafficLast, 'traffic') : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(row as any).trafficChangeValue !== undefined ? 
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      `${(row as any).trafficChangeValue > 0 ? '+' : ''}${(row as any).trafficChangeValue}` : '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.change !== undefined ? (
                      <div className={cn('flex items-center space-x-1', getChangeColor(row.change))}>
                        {getChangeIcon(row.change)}
                        <span className="text-sm font-medium">
                          {row.change > 0 ? '+' : ''}{row.change}%
                        </span>
                      </div>
                    ) : '-'}
                  </TableCell>

                  <TableCell>
                    {row.volume !== undefined ? formatMetricValue(row.volume, 'volume') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        row.source === 'gsc' ? 'bg-blue-100 text-blue-800' : 
                        row.source === 'ahrefs' ? 'bg-orange-100 text-orange-800' :
                        'bg-purple-100 text-purple-800'
                      )}
                    >
                      {row.source.toUpperCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
              {Math.min(currentPage * rowsPerPage, processedData.length)} of{' '}
              {processedData.length} results
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
