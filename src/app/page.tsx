'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, BarChart3, TrendingUp } from 'lucide-react';
import { NormalizedMetric, FilterOptions, ChartDataPoint, SectionFilters } from '@/lib/types';
import { getDateRangePreset } from '@/lib/data-utils';
import { SOURCES } from '@/lib/types';
import { prepareChartData, prepareTableData, extractFilterOptions, normalizeAhrefsData } from '@/lib/data-utils';
import { parseAhrefsCSV, validateCSVFile, readFileAsText } from '@/lib/csv-parser';
import { SectionFilterPanel } from '@/components/filters/section-filter-panel';
import { PerformanceChart } from '@/components/charts/performance-chart';
import { DataTable } from '@/components/tables/data-table';
import { ComparisonDataTable } from '@/components/tables/comparison-data-table';
import { GSCConnection } from '@/components/gsc/gsc-connection';
import { PerformanceClusters } from '@/components/clusters/performance-clusters';
import { saveDataToStorage, loadDataFromStorage, hasStoredData, clearStoredData } from '@/lib/data-storage';

export default function Dashboard() {
  const [data, setData] = useState<NormalizedMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChartMetrics, setSelectedChartMetrics] = useState<string[]>(['clicks']);
  const [tableSourceFilter, setTableSourceFilter] = useState<string>('both'); // 'both', 'gsc', 'ahrefs'

  // Remove 'volume' and 'traffic' from chart metrics if they exist (Ahrefs point-in-time data not suitable for time series)
  useEffect(() => {
    if (selectedChartMetrics.includes('volume') || selectedChartMetrics.includes('traffic')) {
      setSelectedChartMetrics(prev => prev.filter(metric => metric !== 'volume' && metric !== 'traffic'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove dependency to prevent infinite loop
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: getDateRangePreset('last_30_days'),
    metrics: ['clicks', 'impressions', 'ctr', 'position'],
    sources: [SOURCES.GSC, SOURCES.AHREFS],
    enableComparison: false,
    comparisonPreset: undefined,
    comparisonDateRange: undefined,
  });

  // New section-specific filters
  const defaultSectionFilters: SectionFilters = {
    dateRange: getDateRangePreset('last_30_days'),
    enableComparison: false,
  };

  const [sectionFilters, setSectionFilters] = useState({
    chart: { ...defaultSectionFilters },
    quickView: { ...defaultSectionFilters },
    table: { ...defaultSectionFilters },
  });


  // Load persisted data on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      if (hasStoredData()) {
        try {
          setLoading(true);
          const persistedData = await loadDataFromStorage();
          if (persistedData.length > 0) {
            setData(persistedData);
            console.log(`Loaded ${persistedData.length} persisted data points`);
          }
        } catch (error) {
          console.error('Failed to load persisted data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadPersistedData();
  }, []);

  // Calculate filtered data
  const filteredData = useMemo(() => {
    console.log('🔍 Filtering data with current filters:', {
      totalItems: data.length,
      dateRange: filters.dateRange,
      gscItemsWithDates: data.filter(item => item.source === SOURCES.GSC).map(item => ({
        date: item.date,
        query: item.query?.substring(0, 20) + '...'
      })).slice(0, 5)
    });

    return data.filter(item => {
      // Date range filter
      const itemDate = new Date(item.date);
      const startDate = new Date(filters.dateRange.startDate);
      const endDate = new Date(filters.dateRange.endDate);
      
      const dateMatch = itemDate >= startDate && itemDate <= endDate;
      
      if (!dateMatch) {
        if (item.source === SOURCES.GSC && data.filter(d => d.source === SOURCES.GSC).indexOf(item) < 5) {
          console.log('❌ Date filter failed for item:', {
            itemDate: item.date,
            itemDateParsed: itemDate.toISOString(),
            startDate: filters.dateRange.startDate,
            endDate: filters.dateRange.endDate,
            query: item.query?.substring(0, 20),
            source: item.source
          });
        }
        return false;
      }
      
      // Query filter - if queries are selected, item must match at least one
      if (filters.queries && filters.queries.length > 0) {
        const matchesQuery = filters.queries.some(filterQuery =>
          item.query?.toLowerCase().includes(filterQuery.toLowerCase())
        );
        if (!matchesQuery) return false;
      }
      
      // URL filter - if URLs are selected, item must match at least one
      if (filters.urls && filters.urls.length > 0) {
        const matchesUrl = filters.urls.some(filterUrl =>
          item.url?.toLowerCase().includes(filterUrl.toLowerCase())
        );
        if (!matchesUrl) return false;
      }
      
      // Source filter
      const sourceMatch = filters.sources.includes(item.source);
      if (!sourceMatch) {
        if (item.source === SOURCES.GSC && data.filter(d => d.source === SOURCES.GSC).indexOf(item) < 5) {
          console.log('❌ Source filter failed for item:', {
            itemSource: item.source,
            allowedSources: filters.sources,
            query: item.query?.substring(0, 20),
          });
        }
        return false;
      }
      
      // If we get here, all filters passed
      if (item.source === SOURCES.GSC && data.filter(d => d.source === SOURCES.GSC).indexOf(item) < 5) {
        console.log('✅ Item passed all filters:', {
          date: item.date,
          source: item.source,
          query: item.query?.substring(0, 20)
        });
      }
      
      return true;
    });
  }, [data, filters]);

  // Calculate summary statistics from filtered data
  const summaryStats = useMemo(() => {
    console.log('🔍 Calculating summaryStats:', {
      dataLength: data.length,
      filteredDataLength: filteredData.length,
      gscCount: data.filter(item => item.source === SOURCES.GSC).length,
      ahrefsCount: data.filter(item => item.source === SOURCES.AHREFS).length,
      dataSample: data.slice(0, 3),
      filteredSample: filteredData.slice(0, 3)
    });

    const stats = {
      totalClicks: 0,
      totalImpressions: 0,
      avgCTR: 0,
      avgPosition: 0,
      totalVolume: 0,
      totalTraffic: 0,
    };

    if (filteredData.length === 0) {
      console.log('⚠️ No filtered data available for summary stats');
      return stats;
    }

    let positionSum = 0;
    let positionCount = 0;
    let ctrSum = 0;
    let ctrCount = 0;

    filteredData.forEach(item => {
      stats.totalClicks += item.clicks || 0;
      stats.totalImpressions += item.impressions || 0;
      stats.totalVolume += item.volume || 0;
      stats.totalTraffic += item.traffic || 0;

      // Only use GSC data for position calculation (Average Position)
      if (item.position && item.position > 0 && item.source === SOURCES.GSC) {
        positionSum += item.position;
        positionCount++;
      }

      if (item.ctr !== undefined && item.ctr !== null) {
        ctrSum += item.ctr;
        ctrCount++;
      }
    });

    stats.avgPosition = positionCount > 0 ? positionSum / positionCount : 0;
    stats.avgCTR = ctrCount > 0 ? ctrSum / ctrCount : 0;

    return stats;
  }, [data, filteredData]);

  // Derived data
  const filterOptions = useMemo(() => extractFilterOptions(data), [data]); // Use all data for filter options

  // Section-specific filtered data
  const sectionFilteredData = useMemo(() => {
    const filterDataBySection = (sectionFilters: SectionFilters) => {
      const startDate = new Date(sectionFilters.dateRange.startDate);
      const endDate = new Date(sectionFilters.dateRange.endDate);
      
      return data.filter(item => {
        const itemDate = new Date(item.date);
        const dateMatch = itemDate >= startDate && itemDate <= endDate;
        
        // Apply global source filter
        const sourceMatch = filters.sources.includes(item.source);
        
        return dateMatch && sourceMatch;
      });
    };

    return {
      quickView: filterDataBySection(sectionFilters.quickView),
      table: filterDataBySection(sectionFilters.table),
    };
  }, [data, sectionFilters, filters.sources]);
  // Prepare chart data for multiple metrics
  const chartData = useMemo(() => {
    const allChartData: ChartDataPoint[] = [];
    selectedChartMetrics.forEach(metric => {
      // Use all data instead of filteredData - chart will do its own filtering based on sectionFilters
      const metricData = prepareChartData(data, metric, 'date');
      allChartData.push(...metricData);
    });
    return allChartData;
  }, [data, selectedChartMetrics]);

  // Section-specific summary stats for Quick Overview
  const quickViewStats = useMemo(() => {
    console.log('🔍 Calculating Quick Overview stats for date range:', {
      startDate: sectionFilters.quickView.dateRange.startDate,
      endDate: sectionFilters.quickView.dateRange.endDate,
      dataPoints: sectionFilteredData.quickView.length,
      sampleData: sectionFilteredData.quickView.slice(0, 3)
    });

    const stats = {
      totalClicks: 0,
      totalImpressions: 0,
      avgCTR: 0,
      avgPosition: 0,
      totalVolume: 0,
      totalTraffic: 0,
    };

    if (sectionFilteredData.quickView.length === 0) {
      console.log('⚠️ No Quick Overview data for selected date range');
      return stats;
    }

    let positionSum = 0;
    let positionCount = 0;

    console.log('🔍 Quick Overview position debugging:', {
      totalDataPoints: sectionFilteredData.quickView.length,
      gscDataPoints: sectionFilteredData.quickView.filter(item => item.source === SOURCES.GSC).length,
      sampleGSCData: sectionFilteredData.quickView.filter(item => item.source === SOURCES.GSC).slice(0, 3).map(item => ({
        date: item.date,
        source: item.source,
        position: item.position,
        query: item.query?.substring(0, 20)
      }))
    });

    sectionFilteredData.quickView.forEach((item, index) => {
      stats.totalClicks += item.clicks || 0;
      stats.totalImpressions += item.impressions || 0;
      stats.totalVolume += item.volume || 0;
      stats.totalTraffic += item.traffic || 0;

      // Only use GSC data for position calculation (Average Position)
      if (item.position && item.position > 0 && item.source === SOURCES.GSC) {
        positionSum += item.position;
        positionCount++;
        
        // Debug first few position entries
        if (index < 5) {
          console.log(`📊 Position ${positionCount}:`, {
            position: item.position,
            query: item.query?.substring(0, 20),
            date: item.date,
            runningSum: positionSum,
            runningAvg: (positionSum / positionCount).toFixed(2)
          });
        }
      } else if (item.source === SOURCES.GSC && index < 5) {
        console.log(`⚠️ GSC item without valid position:`, {
          position: item.position,
          query: item.query?.substring(0, 20),
          date: item.date,
          hasPosition: !!item.position,
          positionValue: item.position
        });
      }
    });

    // Calculate average position from filtered data
    stats.avgPosition = positionCount > 0 ? positionSum / positionCount : 0;
    
    // Calculate CTR from filtered data: CTR = Total Clicks / Total Impressions
    stats.avgCTR = stats.totalImpressions > 0 ? stats.totalClicks / stats.totalImpressions : 0;

    console.log('📊 Quick Overview calculated stats:', {
      totalClicks: stats.totalClicks,
      totalImpressions: stats.totalImpressions,
      calculatedCTR: stats.avgCTR,
      calculatedCTRPercent: (stats.avgCTR * 100).toFixed(2) + '%',
      avgPosition: stats.avgPosition.toFixed(2),
      positionDataPoints: positionCount
    });

    return stats;
  }, [sectionFilteredData.quickView, sectionFilters.quickView.dateRange]);

  // Comparison stats for Quick Overview (when comparison is enabled)
  const quickViewComparisonStats = useMemo(() => {
    if (!sectionFilters.quickView.enableComparison || !sectionFilters.quickView.comparisonDateRange) {
      return null;
    }

    console.log('🔍 Calculating Quick Overview comparison stats for:', {
      primaryRange: `${sectionFilters.quickView.dateRange.startDate} to ${sectionFilters.quickView.dateRange.endDate}`,
      comparisonRange: `${sectionFilters.quickView.comparisonDateRange.startDate} to ${sectionFilters.quickView.comparisonDateRange.endDate}`
    });

    // Filter data for comparison period
    const comparisonStartDate = new Date(sectionFilters.quickView.comparisonDateRange.startDate);
    const comparisonEndDate = new Date(sectionFilters.quickView.comparisonDateRange.endDate);
    
    const comparisonData = data.filter(item => {
      const itemDate = new Date(item.date);
      const dateMatch = itemDate >= comparisonStartDate && itemDate <= comparisonEndDate;
      const sourceMatch = filters.sources.includes(item.source);
      return dateMatch && sourceMatch;
    });

    console.log('📊 Comparison data points:', comparisonData.length);

    const comparisonStats = {
      totalClicks: 0,
      totalImpressions: 0,
      avgCTR: 0,
      avgPosition: 0,
    };

    if (comparisonData.length === 0) {
      console.log('⚠️ No comparison data for selected range');
      return { current: quickViewStats, previous: comparisonStats, changes: null };
    }

    let positionSum = 0;
    let positionCount = 0;

    comparisonData.forEach(item => {
      comparisonStats.totalClicks += item.clicks || 0;
      comparisonStats.totalImpressions += item.impressions || 0;

      // Only use GSC data for position calculation
      if (item.position && item.position > 0 && item.source === SOURCES.GSC) {
        positionSum += item.position;
        positionCount++;
      }
    });

    // Calculate comparison period metrics
    comparisonStats.avgPosition = positionCount > 0 ? positionSum / positionCount : 0;
    comparisonStats.avgCTR = comparisonStats.totalImpressions > 0 ? comparisonStats.totalClicks / comparisonStats.totalImpressions : 0;

    // Calculate percentage changes
    const changes = {
      clicksChange: comparisonStats.totalClicks > 0 ? 
        Math.round(((quickViewStats.totalClicks - comparisonStats.totalClicks) / comparisonStats.totalClicks) * 100) : 0,
      impressionsChange: comparisonStats.totalImpressions > 0 ? 
        Math.round(((quickViewStats.totalImpressions - comparisonStats.totalImpressions) / comparisonStats.totalImpressions) * 100) : 0,
      ctrChange: comparisonStats.avgCTR > 0 ? 
        Math.round(((quickViewStats.avgCTR - comparisonStats.avgCTR) / comparisonStats.avgCTR) * 100) : 0,
      positionChange: comparisonStats.avgPosition > 0 ? 
        Math.round(((comparisonStats.avgPosition - quickViewStats.avgPosition) / comparisonStats.avgPosition) * 100) : 0, // Note: lower position is better, so we flip the calculation
    };

    console.log('📈 Comparison results:', {
      current: quickViewStats,
      previous: comparisonStats,
      changes
    });

    return { current: quickViewStats, previous: comparisonStats, changes };
  }, [quickViewStats, sectionFilters.quickView.enableComparison, sectionFilters.quickView.comparisonDateRange, data, filters.sources]);

  const tableData = prepareTableData(sectionFilteredData.table, sectionFilters.table.enableComparison);
  
  // Filter table data by source
  const filteredTableData = useMemo(() => {
    if (tableSourceFilter === 'both') return tableData;
    if (tableSourceFilter === 'gsc') return tableData.filter(row => row.source === 'GSC' || row.source === 'Both');
    if (tableSourceFilter === 'ahrefs') return tableData.filter(row => row.source === 'Ahrefs' || row.source === 'Both');
    return tableData;
  }, [tableData, tableSourceFilter]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateCSVFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setLoading(true);
    try {
      // Read file content
      const csvContent = await readFileAsText(file);
      
      // Parse CSV
      const parseResult = await parseAhrefsCSV(csvContent);
      
      if (parseResult.success && parseResult.data) {
        // Normalize and add to existing data
        const normalizedData = normalizeAhrefsData(parseResult.data);
        const gscData = data.filter(item => item.source === SOURCES.GSC);
        const newData = [...gscData, ...normalizedData];
        
        setData(newData);
        
        // Save to persistent storage
        try {
          await saveDataToStorage(newData);
          console.log('Ahrefs data saved to storage');
        } catch (error) {
          console.error('Failed to save Ahrefs data:', error);
        }
        
        // Show success message
        const successMessage = `✅ Successfully imported ${parseResult.validRows} rows from ${parseResult.totalRows} total rows.`;
        alert(successMessage);
        
        if (parseResult.errors && parseResult.errors.length > 0) {
          console.warn('Import warnings:', parseResult.errors);
          if (parseResult.errors.length < 10) {
            alert(`⚠️ Some rows had issues:\n${parseResult.errors.slice(0, 5).join('\n')}`);
          }
        }
      } else {
        alert(`Failed to import CSV: ${parseResult.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('CSV import error:', error);
      alert('Failed to process CSV file. Please check the file format.');
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleGSCData = async (gscData: NormalizedMetric[]) => {
    console.log('📊 handleGSCData called with:', {
      gscDataCount: gscData.length,
      gscSample: gscData.slice(0, 3),
      currentDataCount: data.length,
      currentAhrefsCount: data.filter(item => item.source === SOURCES.AHREFS).length
    });

    try {
      // Replace existing GSC data and merge with Ahrefs data
      const ahrefsData = data.filter(item => item.source === SOURCES.AHREFS);
      const newData = [...gscData, ...ahrefsData];
      
      console.log('📊 Setting new data:', {
        gscCount: gscData.length,
        ahrefsCount: ahrefsData.length,
        totalCount: newData.length,
        newDataSample: newData.slice(0, 3)
      });
      
      setData(newData);
      
      // Save to persistent storage
      await saveDataToStorage(newData);
      console.log('GSC data saved to storage');
    } catch (error) {
      console.error('Failed to save GSC data:', error);
      // Still update the UI even if storage fails
      const ahrefsData = data.filter(item => item.source === SOURCES.AHREFS);
      setData([...gscData, ...ahrefsData]);
    }
  };

  const downloadSampleCSV = () => {
    const sampleCSV = `Keyword,Current URL,Current position,Volume,KD,CPC,Current organic traffic,Current date,Previous organic traffic,Organic traffic change,Previous position,Position change,Previous date
seo reporting tool,https://example.com/seo-tools,3,1200,45,2.50,180,2024-01-01,150,-30,5,2,2023-12-01
keyword research,https://example.com/blog/keyword-research,7,800,35,1.80,120,2024-01-01,100,-20,9,2,2023-12-01
search console api,https://example.com/api-docs,12,500,25,3.20,80,2024-01-01,60,-20,15,3,2023-12-01`;
    
    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ahrefs-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Performance Metrics - Medcerts.com
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Real-time SEO performance data
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Sources Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Data Sources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Google Search Console */}
            <GSCConnection 
              onDataFetch={handleGSCData}
            />

            {/* Ahrefs CSV Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-orange-600" />
                  <span>Ahrefs Data</span>
                </CardTitle>
                <CardDescription>
                  Upload CSV exports from Ahrefs for keyword and ranking data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      disabled={loading}
                      onClick={() => {
                        const input = document.getElementById('csv-upload') as HTMLInputElement;
                        input?.click();
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {loading ? 'Processing CSV...' : 'Upload CSV'}
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="w-full text-xs" 
                      onClick={downloadSampleCSV}
                    >
                      Download Sample CSV Format
                    </Button>
                  </div>
                  
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-sm">
                      <div className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Ahrefs Export Tip</div>
                      <div className="text-blue-700 dark:text-blue-300 text-xs space-y-1">
                        <div>For best results, export Ahrefs data comparing two dates:</div>
                        <div><strong>Example:</strong> Today vs 90 days ago</div>
                        <div>This includes change columns: position change, traffic change, etc.</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="font-medium">Expected columns:</div>
                    <div>keyword, url, position, volume, difficulty, cpc, traffic, date</div>
                    <div className="mt-2 text-gray-400">
                      <strong>File size limit:</strong> Up to 50MB supported
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Data Status */}
        {data.length > 0 && (
          <div className="mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Imported Data Status
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (confirm('Are you sure you want to clear all imported data? This cannot be undone.')) {
                      try {
                        await clearStoredData();
                        setData([]);
                        console.log('All data cleared');
                      } catch (error) {
                        console.error('Failed to clear data:', error);
                        alert('Failed to clear data. Please try again.');
                      }
                    }
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Clear All Data
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* GSC Data Status */}
                {data.some(item => item.source === 'gsc') && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="font-medium text-blue-900 dark:text-blue-100">Google Search Console</span>
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      {(() => {
                        const gscData = data.filter(item => item.source === 'gsc');
                        const dates = gscData.map(item => item.date).sort();
                        const startDate = dates[0];
                        const endDate = dates[dates.length - 1];
                        return (
                          <>
                            <div><strong>Date Range:</strong> {startDate} to {endDate}</div>
                            <div><strong>Data Points:</strong> {gscData.length.toLocaleString()}</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                {/* Ahrefs Data Status */}
                {data.some(item => item.source === 'ahrefs') && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <span className="font-medium text-orange-900 dark:text-orange-100">Ahrefs</span>
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-300">
                      {(() => {
                        const ahrefsData = data.filter(item => item.source === 'ahrefs');
                        const dates = ahrefsData.map(item => item.date).sort();
                        const startDate = dates[0];
                        const endDate = dates[dates.length - 1];
                        return (
                          <>
                            <div><strong>Date Range:</strong> {startDate} to {endDate}</div>
                            <div><strong>Data Points:</strong> {ahrefsData.length.toLocaleString()}</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Overall Coverage */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Total Coverage:</strong> {(() => {
                    const allDates = data.map(item => item.date).sort();
                    const startDate = allDates[0];
                    const endDate = allDates[allDates.length - 1];
                    return `${startDate} to ${endDate} (${data.length.toLocaleString()} total data points)`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Quick Overview</span>
            </CardTitle>
            <CardDescription>
              Key performance metrics with independent date range and comparison controls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quick Overview-specific filters */}
            <SectionFilterPanel
              title="Overview Filters"
              description="Control date range and comparison for overview cards"
              icon={<TrendingUp className="h-4 w-4 text-green-500" />}
              filters={sectionFilters.quickView}
              onFiltersChange={(newFilters) => 
                setSectionFilters(prev => ({ ...prev, quickView: newFilters }))
              }
              className="border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20"
            />
            
            {/* Overview date range display */}
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Showing data for:</span>
              <span>
                {new Date(sectionFilters.quickView.dateRange.startDate).toLocaleDateString()} - {new Date(sectionFilters.quickView.dateRange.endDate).toLocaleDateString()}
              </span>
            </div>
            
            {/* Overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                <div className="flex items-center space-x-1">
                  {quickViewComparisonStats?.changes && (
                    <div className={`text-xs font-medium ${
                      quickViewComparisonStats.changes.clicksChange > 0 ? 'text-green-600' : 
                      quickViewComparisonStats.changes.clicksChange < 0 ? 'text-red-600' : 
                      'text-gray-500'
                    }`}>
                      {quickViewComparisonStats.changes.clicksChange > 0 ? '+' : ''}{quickViewComparisonStats.changes.clicksChange}%
                    </div>
                  )}
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {sectionFilters.quickView.enableComparison && quickViewComparisonStats?.changes ? (
                  <div>
                    <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                      {quickViewStats.totalClicks.toLocaleString()} vs {quickViewComparisonStats.previous.totalClicks.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current vs Previous period
                    </div>
                  </div>
                ) : (
                  <div className="text-2xl font-bold">
                    {quickViewStats.totalClicks.toLocaleString()}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  From {sectionFilteredData.quickView.length} data points
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <div className="flex items-center space-x-1">
                  {quickViewComparisonStats?.changes && (
                    <div className={`text-xs font-medium ${
                      quickViewComparisonStats.changes.impressionsChange > 0 ? 'text-green-600' : 
                      quickViewComparisonStats.changes.impressionsChange < 0 ? 'text-red-600' : 
                      'text-gray-500'
                    }`}>
                      {quickViewComparisonStats.changes.impressionsChange > 0 ? '+' : ''}{quickViewComparisonStats.changes.impressionsChange}%
                    </div>
                  )}
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {sectionFilters.quickView.enableComparison && quickViewComparisonStats?.changes ? (
                  <div>
                    <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                      {quickViewStats.totalImpressions.toLocaleString()} vs {quickViewComparisonStats.previous.totalImpressions.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current vs Previous period
                    </div>
                  </div>
                ) : (
                  <div className="text-2xl font-bold">
                    {quickViewStats.totalImpressions.toLocaleString()}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  From GSC & Ahrefs data
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. CTR</CardTitle>
                <div className="flex items-center space-x-1">
                  {quickViewComparisonStats?.changes && (
                    <div className={`text-xs font-medium ${
                      quickViewComparisonStats.changes.ctrChange > 0 ? 'text-green-600' : 
                      quickViewComparisonStats.changes.ctrChange < 0 ? 'text-red-600' : 
                      'text-gray-500'
                    }`}>
                      {quickViewComparisonStats.changes.ctrChange > 0 ? '+' : ''}{quickViewComparisonStats.changes.ctrChange}%
                    </div>
                  )}
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {sectionFilters.quickView.enableComparison && quickViewComparisonStats?.changes ? (
                  <div>
                    <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                      {(quickViewStats.avgCTR * 100).toFixed(1)}% vs {(quickViewComparisonStats.previous.avgCTR * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current vs Previous period
                    </div>
                  </div>
                ) : (
                  <div className="text-2xl font-bold">
                    {(quickViewStats.avgCTR * 100).toFixed(1)}%
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Click-through rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Position</CardTitle>
                <div className="flex items-center space-x-1">
                  {quickViewComparisonStats?.changes && (
                    <div className={`text-xs font-medium ${
                      quickViewComparisonStats.changes.positionChange > 0 ? 'text-green-600' : 
                      quickViewComparisonStats.changes.positionChange < 0 ? 'text-red-600' : 
                      'text-gray-500'
                    }`}>
                      {quickViewComparisonStats.changes.positionChange > 0 ? '+' : ''}{quickViewComparisonStats.changes.positionChange}%
                    </div>
                  )}
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {sectionFilters.quickView.enableComparison && quickViewComparisonStats?.changes && quickViewStats.avgPosition > 0 ? (
                  <div>
                    <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                      {quickViewStats.avgPosition.toFixed(1)} vs {quickViewComparisonStats.previous.avgPosition.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current vs Previous period
                    </div>
                  </div>
                ) : (
                  <div className="text-2xl font-bold">
                    {quickViewStats.avgPosition > 0 ? quickViewStats.avgPosition.toFixed(1) : 'N/A'}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Average ranking position
                </p>
              </CardContent>
            </Card>
          </div>
          </CardContent>
        </Card>

        {/* Charts and Tables */}
        <div className="space-y-8">
          {/* Performance Charts */}
          <PerformanceChart
            data={chartData}
            selectedMetrics={selectedChartMetrics}
            onMetricsChange={setSelectedChartMetrics}
            availableMetrics={filters.metrics.filter(metric => metric !== 'volume' && metric !== 'traffic')}
            sectionFilters={sectionFilters.chart}
            title="Performance Charts"
            description="Visualize your metrics over time"
            showSectionFilters={true}
            onSectionFiltersChange={(newFilters) => 
              setSectionFilters(prev => ({ ...prev, chart: newFilters }))
            }
          />

          {/* Performance Data Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Performance Data</span>
                  </CardTitle>
                  <CardDescription>
                    Detailed metrics for your queries and pages with independent filtering
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">Filter by source:</span>
                  <div className="flex space-x-2">
                    {[
                      { value: 'both', label: 'Both Sources' },
                      { value: 'gsc', label: 'GSC Only' },
                      { value: 'ahrefs', label: 'Ahrefs Only' }
                    ].map((option) => (
                      <Button
                        key={option.value}
                        variant={tableSourceFilter === option.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTableSourceFilter(option.value)}
                        className="text-xs"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Table-specific filters */}
              <SectionFilterPanel
                title="Table Filters"
                description="Control date range and comparison for table data"
                icon={<BarChart3 className="h-4 w-4 text-purple-500" />}
                filters={sectionFilters.table}
                onFiltersChange={(newFilters) => 
                  setSectionFilters(prev => ({ ...prev, table: newFilters }))
                }
                className="border border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-900/20"
              />
              
              {/* Table date range display */}
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Table showing data for:</span>
                <span>
                  {new Date(sectionFilters.table.dateRange.startDate).toLocaleDateString()} - {new Date(sectionFilters.table.dateRange.endDate).toLocaleDateString()}
                </span>
              </div>
              
              {/* Table content */}
              {sectionFilters.table.enableComparison ? (
                <ComparisonDataTable
                  data={filteredTableData}
                  loading={loading}
                  title=""
                  description=""
                  comparisonStartDate={sectionFilters.table.comparisonDateRange?.startDate || sectionFilters.table.dateRange.startDate}
                  comparisonEndDate={sectionFilters.table.comparisonDateRange?.endDate || sectionFilters.table.dateRange.endDate}
                />
              ) : (
                <DataTable
                  data={filteredTableData}
                  loading={loading}
                  title=""
                  description=""
                />
              )}
            </CardContent>
          </Card>

          {/* Performance Clusters */}
          <PerformanceClusters
            data={filteredData}
            filters={filters}
          />
        </div>
      </main>
    </div>
  );
}