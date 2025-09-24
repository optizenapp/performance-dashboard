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

interface DataTableProps {
  data: TableRowType[];
  title?: string;
  description?: string;
  loading?: boolean;
  onExport?: (format: 'csv' | 'json') => void;
}

type SortField = keyof TableRowType;
type SortDirection = 'asc' | 'desc' | null;

export function DataTable({
  data,
  title = 'Performance Data',
  description = 'Detailed metrics for your queries and pages',
  loading = false,
  onExport,
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('clicks');
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
        const aVal = a[sortField];
        const bVal = b[sortField];
        
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
        setSortField('clicks'); // Default sort
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4" />;
    }
    return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      const csvContent = exportToCSV(processedData);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seo-metrics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const jsonContent = JSON.stringify(processedData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seo-metrics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    if (onExport) {
      onExport(format);
    }
  };

  const getChangeIcon = (change?: number) => {
    if (!change) return null;
    if (change > 0) {
      return <TrendingUp className="h-3 w-3 text-green-600" />;
    }
    return <TrendingDown className="h-3 w-3 text-red-600" />;
  };

  const getChangeColor = (change?: number) => {
    if (!change) return 'text-gray-500';
    return change > 0 ? 'text-green-600' : 'text-red-600';
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
                <TableHead className="w-[250px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('query')}
                    className="h-auto p-0 font-semibold"
                  >
                    Query
                    {getSortIcon('query')}
                  </Button>
                </TableHead>
                <TableHead className="w-[200px]">
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
                    onClick={() => handleSort('clicks')}
                    className="h-auto p-0 font-semibold"
                  >
                    Clicks
                    {getSortIcon('clicks')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('impressions')}
                    className="h-auto p-0 font-semibold"
                  >
                    Impressions
                    {getSortIcon('impressions')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('ctr')}
                    className="h-auto p-0 font-semibold"
                  >
                    CTR
                    {getSortIcon('ctr')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('position')}
                    className="h-auto p-0 font-semibold"
                  >
                    Position
                    {getSortIcon('position')}
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
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, index) => (
                <TableRow key={`${row.query}-${index}`}>
                  <TableCell className="font-medium">
                    {row.query}
                  </TableCell>
                  <TableCell>
                    {row.url ? (
                      <a
                        href={row.url.startsWith('http') ? row.url : `https://${row.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        title={row.url}
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate max-w-[180px]">
                          {row.url}
                        </span>
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.clicks !== undefined ? formatMetricValue(row.clicks, 'clicks') : '-'}
                  </TableCell>
                  <TableCell>
                    {row.impressions !== undefined ? formatMetricValue(row.impressions, 'impressions') : '-'}
                  </TableCell>
                  <TableCell>
                    {row.ctr !== undefined ? formatMetricValue(row.ctr, 'ctr') : '-'}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      'font-medium',
                      row.position && row.position <= 3 ? 'text-green-600' :
                      row.position && row.position <= 10 ? 'text-yellow-600' :
                      'text-red-600'
                    )}>
                      {row.position ? formatMetricValue(row.position, 'position') : 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.volume !== undefined ? formatMetricValue(row.volume, 'volume') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={cn(
                        row.source === 'gsc' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                      )}
                    >
                      {row.source.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.change !== undefined ? (
                      <div className={cn('flex items-center space-x-1', getChangeColor(row.change))}>
                        {getChangeIcon(row.change)}
                        <span className="text-sm font-medium">
                          {row.change > 0 ? '+' : ''}{row.change}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
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
