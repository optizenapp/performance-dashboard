'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Download, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { NormalizedMetric, SectionFilters } from '@/lib/types';

interface AhrefsComparisonTableRow {
  keyword: string;
  currentUrl: string;
  serpFeatures: string;
  volume: number;
  kd: number;
  currentDate: string;
  previousDate: string;
  currentTraffic: number;
  currentPosition: number;
  previousTraffic: number;
  previousPosition: number;
  trafficChange: number;
  trafficChangePercent: number;
  positionChange: number;
  positionChangePercent: number;
}

interface AhrefsComparisonTableProps {
  data: NormalizedMetric[];
  comparisonData: NormalizedMetric[];
  loading?: boolean;
  sectionFilters: SectionFilters;
}

type SortField = keyof AhrefsComparisonTableRow;
type SortDirection = 'asc' | 'desc' | null;

export function AhrefsComparisonTable({
  data,
  comparisonData,
  loading = false,
  sectionFilters,
}: AhrefsComparisonTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('trafficChangePercent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50);
  const [changeFilter, setChangeFilter] = useState<'all' | 'traffic' | 'position' | 'both'>('all');

  // Process comparison data
  const processedData = useMemo(() => {
    if (!sectionFilters.enableComparison || !data.length) {
      console.log('🔍 Ahrefs Comparison - No data to process:', {
        enableComparison: sectionFilters.enableComparison,
        dataLength: data.length,
        comparisonDataLength: comparisonData.length
      });
      return [];
    }

    console.log('🔍 Ahrefs Comparison - Processing data:', {
      currentDataCount: data.length,
      comparisonDataCount: comparisonData.length,
      sampleCurrentData: data.slice(0, 2).map(item => ({
        query: item.query,
        traffic: item.traffic,
        previousTraffic: item.previousTraffic,
        position: item.position,
        previousPosition: item.previousPosition,
        hasTrafficData: !!(item.traffic && item.previousTraffic),
        hasPositionData: !!(item.position && item.previousPosition)
      }))
    });

    // For Ahrefs, each row already contains comparison data
    // No need to match between datasets - just process each row
    const rows: AhrefsComparisonTableRow[] = [];

    data.forEach(item => {
      if (!item.query) return;
      
      const currentTraffic = item.traffic || 0;
      const previousTraffic = item.previousTraffic || 0;
      const currentPosition = item.position || 0;
      const previousPosition = item.previousPosition || 0;

      const trafficChange = currentTraffic - previousTraffic;
      const trafficChangePercent = previousTraffic > 0 ? 
        ((currentTraffic - previousTraffic) / previousTraffic) * 100 : 
        currentTraffic > 0 ? 100 : 0;

      const positionChange = currentPosition - previousPosition;
      const positionChangePercent = previousPosition > 0 ? 
        ((currentPosition - previousPosition) / previousPosition) * 100 : 0;

      rows.push({
        keyword: item.query || '',
        currentUrl: item.url || '',
          serpFeatures: item.serpFeatures || '',
          volume: item.volume || 0,
        kd: item.difficulty || 0,
        currentDate: item.date || '',
        previousDate: item.previousDate || '',
        currentTraffic,
        currentPosition,
        previousTraffic,
        previousPosition,
        trafficChange,
        trafficChangePercent,
          positionChange,
          positionChangePercent
        });
    });

    // Find high traffic keywords for debugging
    const highTrafficRows = rows.filter(r => r.currentTraffic > 10000);
    const medcertsRow = rows.find(r => r.keyword.toLowerCase().includes('medcerts'));
    
    console.log('✅ Ahrefs Comparison processed:', {
      totalRows: rows.length,
      highTrafficRows: highTrafficRows.length,
      highTrafficSample: highTrafficRows.slice(0, 3).map(r => ({
        keyword: r.keyword,
        currentTraffic: r.currentTraffic,
        previousTraffic: r.previousTraffic
      })),
      medcertsFound: !!medcertsRow,
      medcertsData: medcertsRow ? {
        keyword: medcertsRow.keyword,
        currentTraffic: medcertsRow.currentTraffic,
        previousTraffic: medcertsRow.previousTraffic
      } : null,
      trafficStats: {
        rowsWithCurrentTraffic: rows.filter(r => r.currentTraffic > 0).length,
        rowsWithPreviousTraffic: rows.filter(r => r.previousTraffic > 0).length,
        rowsWithBothTraffic: rows.filter(r => r.currentTraffic > 0 && r.previousTraffic > 0).length
      },
      topTrafficRows: rows.sort((a, b) => b.currentTraffic - a.currentTraffic).slice(0, 5).map(r => ({
        keyword: r.keyword,
        currentTraffic: r.currentTraffic
      }))
    });

    return rows;
  }, [data, comparisonData, sectionFilters.enableComparison]);

  // Filter and sort
  const filteredAndSortedData = useMemo(() => {
    let filtered = processedData;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(row => 
        row.keyword.toLowerCase().includes(term) ||
        row.currentUrl.toLowerCase().includes(term) ||
        row.serpFeatures.toLowerCase().includes(term)
      );
    }

    // Apply change filter
    if (changeFilter !== 'all') {
      filtered = filtered.filter(row => {
        const hasTrafficChange = row.trafficChangePercent !== 0;
        const hasPositionChange = row.positionChangePercent !== 0;
        
        switch (changeFilter) {
          case 'traffic':
            return hasTrafficChange;
          case 'position':
            return hasPositionChange;
          case 'both':
            return hasTrafficChange && hasPositionChange;
          default:
            return true;
        }
      });
    }

    // Apply crawl date filter using existing section filter
    const ahrefsFilter = (sectionFilters as { ahrefsComparisonFilter?: string }).ahrefsComparisonFilter || 'all_data';
    if (ahrefsFilter !== 'all_data' && ahrefsFilter !== 'all_changes') {
      const today = new Date();
      filtered = filtered.filter(row => {
        if (!row.currentDate) return false;
        
        try {
          const crawlDate = new Date(row.currentDate);
          if (isNaN(crawlDate.getTime())) return false;
          
          const daysDiff = Math.floor((today.getTime() - crawlDate.getTime()) / (1000 * 60 * 60 * 24));
          
          switch (ahrefsFilter) {
            case 'last_24_hours':
              return daysDiff <= 1;
            case 'last_7_days':
              return daysDiff <= 7;
            case 'last_14_days':
              return daysDiff <= 14;
            case 'last_30_days':
              return daysDiff <= 30;
            case 'last_60_days':
              return daysDiff <= 60;
            case 'last_90_days':
              return daysDiff <= 90;
            case 'last_6_months':
              return daysDiff <= 180;
            default:
              return true;
          }
        } catch {
          return false;
        }
      });
    }

    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    // Debug filtering results
    const medcertsInFiltered = filtered.find(r => r.keyword.toLowerCase().includes('medcerts'));
    console.log('🔍 Ahrefs Filtering Results:', {
      originalCount: processedData.length,
      afterSearchFilter: searchTerm ? 'applied' : 'skipped',
      afterChangeFilter: changeFilter !== 'all' ? 'applied' : 'skipped', 
      afterCrawlDateFilter: (sectionFilters as { ahrefsComparisonFilter?: string }).ahrefsComparisonFilter !== 'all_data' && (sectionFilters as { ahrefsComparisonFilter?: string }).ahrefsComparisonFilter !== 'all_changes' ? 'applied' : 'skipped',
      finalCount: filtered.length,
      medcertsStillPresent: !!medcertsInFiltered,
      topTrafficInFiltered: filtered.sort((a, b) => b.currentTraffic - a.currentTraffic).slice(0, 3).map(r => ({
        keyword: r.keyword,
        currentTraffic: r.currentTraffic
      }))
    });

    return filtered;
  }, [processedData, searchTerm, changeFilter, (sectionFilters as { ahrefsComparisonFilter?: string }).ahrefsComparisonFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + rowsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4" />;
  };

  const ChangeIndicator = ({ value }: { value: number }) => (
    <span className={`flex items-center space-x-1 ${
      value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-500'
    }`}>
      {value > 0 && <TrendingUp className="h-3 w-3" />}
      {value < 0 && <TrendingDown className="h-3 w-3" />}
      <span>{value > 0 ? '+' : ''}{value.toFixed(0)}%</span>
        </span>
    );

  if (loading) {
    return <div className="text-center py-8">Loading Ahrefs comparison data...</div>;
  }

  if (!sectionFilters.enableComparison) {
    return <div className="text-center py-8 text-gray-500">Enable comparison mode to view Ahrefs comparison data</div>;
  }

  if (processedData.length === 0) {
    return (
      <div className="text-center py-8 text-amber-600">
        <div className="font-medium mb-2">No Ahrefs comparison data available</div>
        <div className="text-sm text-gray-500">
          Current data: {data?.length || 0} rows, Comparison data: {comparisonData?.length || 0} rows
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search keywords or URLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
          />
        </div>
          
          {/* Change Filter */}
          <div className="flex items-center space-x-3">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show rows with:</Label>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="all"
                  name="changeFilter"
                  value="all"
                  checked={changeFilter === 'all'}
                  onChange={(e) => {
                    setChangeFilter(e.target.value as 'all' | 'traffic' | 'position' | 'both');
                    setCurrentPage(1);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <Label htmlFor="all" className="text-sm cursor-pointer">All rows</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="traffic"
                  name="changeFilter"
                  value="traffic"
                  checked={changeFilter === 'traffic'}
                  onChange={(e) => {
                    setChangeFilter(e.target.value as 'all' | 'traffic' | 'position' | 'both');
                    setCurrentPage(1);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <Label htmlFor="traffic" className="text-sm cursor-pointer">Traffic changes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="position"
                  name="changeFilter"
                  value="position"
                  checked={changeFilter === 'position'}
                  onChange={(e) => {
                    setChangeFilter(e.target.value as 'all' | 'traffic' | 'position' | 'both');
                    setCurrentPage(1);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <Label htmlFor="position" className="text-sm cursor-pointer">Position changes</Label>
              </div>
              <div className="flex items-center space-x-2">
          <input
                  type="radio"
                  id="both"
                  name="changeFilter"
                  value="both"
                  checked={changeFilter === 'both'}
                  onChange={(e) => {
                    setChangeFilter(e.target.value as 'all' | 'traffic' | 'position' | 'both');
                    setCurrentPage(1);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <Label htmlFor="both" className="text-sm cursor-pointer">Both changes</Label>
              </div>
            </div>
          </div>
        </div>
        <Button onClick={() => {
          // Create CSV content
          const exportData = filteredAndSortedData.map(row => ({
            'Keyword': row.keyword,
            'Current URL': row.currentUrl,
            'SERP Features': row.serpFeatures,
            'Volume': row.volume,
            'KD': row.kd,
            'Current Crawl Date': row.currentDate,
            'Previous Crawl Date': row.previousDate,
            'Current Traffic': row.currentTraffic,
            'Previous Traffic': row.previousTraffic,
            'Traffic Change %': row.trafficChangePercent.toFixed(1),
            'Current Position': row.currentPosition,
            'Previous Position': row.previousPosition,
            'Position Change %': row.positionChangePercent.toFixed(1)
          }));
          
          const headers = Object.keys(exportData[0] || {});
          const csvContent = [
            headers.join(','),
            ...exportData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
          ].join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'ahrefs-comparison.csv';
          a.click();
          URL.revokeObjectURL(url);
        }} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Ahrefs Comparison Info */}
      <div className="text-sm text-gray-600 dark:text-gray-400 bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
        <strong>Ahrefs Comparison:</strong> Showing traffic and position changes from CSV data
        <br />
      <strong>Filter:</strong> {(() => {
        const filter = (sectionFilters as { ahrefsComparisonFilter?: string }).ahrefsComparisonFilter || 'all_data';
        switch (filter) {
          case 'all_data': return 'All data (no filtering applied)';
          case 'all_changes': return 'All changes (no date filter)';
          case 'last_24_hours': return 'Changes detected in last 24 hours';
          case 'last_7_days': return 'Changes detected in last 7 days';
          case 'last_14_days': return 'Changes detected in last 14 days';
          case 'last_30_days': return 'Changes detected in last 30 days';
          case 'last_60_days': return 'Changes detected in last 60 days';
          case 'last_90_days': return 'Changes detected in last 90 days';
          case 'last_6_months': return 'Changes detected in last 6 months';
          default: return filter.replace(/_/g, ' ');
        }
      })()}
        <br />
        <strong>Data:</strong> Each row compares current vs previous traffic/position from Ahrefs crawl data
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="border-r">
                <Button variant="ghost" onClick={() => handleSort('keyword')} className="h-auto p-0 font-semibold hover:bg-transparent">
                  Keyword {getSortIcon('keyword')}
                </Button>
              </TableHead>
              <TableHead rowSpan={2} className="border-r w-[200px]">
                <Button variant="ghost" onClick={() => handleSort('serpFeatures')} className="h-auto p-0 font-semibold hover:bg-transparent">
                  SERP Features {getSortIcon('serpFeatures')}
                </Button>
              </TableHead>
              <TableHead rowSpan={2} className="border-r text-right">
                <Button variant="ghost" onClick={() => handleSort('volume')} className="h-auto p-0 font-semibold hover:bg-transparent">
                  Volume {getSortIcon('volume')}
                </Button>
              </TableHead>
              <TableHead rowSpan={2} className="border-r text-right">
                <Button variant="ghost" onClick={() => handleSort('kd')} className="h-auto p-0 font-semibold hover:bg-transparent">
                  KD {getSortIcon('kd')}
                </Button>
              </TableHead>
              <TableHead colSpan={2} className="text-center border-r bg-gray-50 dark:bg-gray-950/20">Crawl Dates</TableHead>
              <TableHead colSpan={3} className="text-center border-r bg-blue-50 dark:bg-blue-950/20">Traffic</TableHead>
              <TableHead colSpan={3} className="text-center bg-purple-50 dark:bg-purple-950/20">Position</TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="text-center text-xs bg-gray-25">
                <Button variant="ghost" onClick={() => handleSort('currentDate')} className="h-auto p-0 text-xs hover:bg-transparent">
                  Current {getSortIcon('currentDate')}
                </Button>
              </TableHead>
              <TableHead className="text-center text-xs border-r bg-gray-25">
                <Button variant="ghost" onClick={() => handleSort('previousDate')} className="h-auto p-0 text-xs hover:bg-transparent">
                  Previous {getSortIcon('previousDate')}
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-blue-25">
                <Button variant="ghost" onClick={() => handleSort('currentTraffic')} className="h-auto p-0 text-xs hover:bg-transparent">
                  Current {getSortIcon('currentTraffic')}
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-blue-25">
                <Button variant="ghost" onClick={() => handleSort('previousTraffic')} className="h-auto p-0 text-xs hover:bg-transparent">
                  Previous {getSortIcon('previousTraffic')}
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs border-r bg-blue-25">
                <Button variant="ghost" onClick={() => handleSort('trafficChangePercent')} className="h-auto p-0 text-xs hover:bg-transparent">
                  % Change {getSortIcon('trafficChangePercent')}
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-purple-25">
                <Button variant="ghost" onClick={() => handleSort('currentPosition')} className="h-auto p-0 text-xs hover:bg-transparent">
                  Current {getSortIcon('currentPosition')}
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-purple-25">
                <Button variant="ghost" onClick={() => handleSort('previousPosition')} className="h-auto p-0 text-xs hover:bg-transparent">
                  Previous {getSortIcon('previousPosition')}
                </Button>
              </TableHead>
              <TableHead className="text-right text-xs bg-purple-25">
                <Button variant="ghost" onClick={() => handleSort('positionChangePercent')} className="h-auto p-0 text-xs hover:bg-transparent">
                  % Change {getSortIcon('positionChangePercent')}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, index) => (
              <TableRow key={`${row.keyword}-${index}`}>
                <TableCell className="font-medium max-w-[200px]">
                  <div className="truncate" title={row.keyword}>{row.keyword}</div>
                  {row.currentUrl && (
                    <div className="flex items-center mt-1">
                      <ExternalLink className="h-3 w-3 text-gray-400 mr-1" />
                      <a href={row.currentUrl} target="_blank" rel="noopener noreferrer" 
                         className="text-xs text-blue-600 hover:underline truncate max-w-[180px]" title={row.currentUrl}>
                        {row.currentUrl}
                      </a>
                    </div>
                    )}
                  </TableCell>
                <TableCell className="w-[200px] max-w-[200px]">
                    {row.serpFeatures ? (
                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-tight" title={row.serpFeatures}>
                      <span className="line-clamp-2 break-words">{row.serpFeatures}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                <TableCell className="text-right font-mono">{row.volume > 0 ? row.volume.toLocaleString() : '-'}</TableCell>
                <TableCell className="text-right font-mono">{row.kd > 0 ? row.kd : '-'}</TableCell>
                <TableCell className="text-center text-xs font-mono">
                  {row.currentDate ? (
                    <div title={row.currentDate}>
                      {new Date(row.currentDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                <TableCell className="text-center text-xs font-mono border-r">
                  {row.previousDate ? (
                    <div title={row.previousDate}>
                      {new Date(row.previousDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                <TableCell className="text-right font-mono text-xs">{row.currentTraffic > 0 ? row.currentTraffic.toLocaleString() : '-'}</TableCell>
                <TableCell className="text-right font-mono text-xs">{row.previousTraffic > 0 ? row.previousTraffic.toLocaleString() : '-'}</TableCell>
                <TableCell className="text-right text-xs"><ChangeIndicator value={row.trafficChangePercent} /></TableCell>
                <TableCell className="text-right font-mono text-xs">{row.currentPosition > 0 ? row.currentPosition.toFixed(1) : '-'}</TableCell>
                <TableCell className="text-right font-mono text-xs">{row.previousPosition > 0 ? row.previousPosition.toFixed(1) : '-'}</TableCell>
                <TableCell className="text-right text-xs"><ChangeIndicator value={-row.positionChangePercent} /></TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} results
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
              Previous
            </Button>
            <span className="text-sm">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}