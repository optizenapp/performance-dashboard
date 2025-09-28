'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, BarChart3, TrendingUp, LogIn, LogOut } from 'lucide-react';
import Image from 'next/image';
import { NormalizedMetric, FilterOptions, ChartDataPoint, SectionFilters } from '@/lib/types';
import { getDateRangePreset } from '@/lib/data-utils';
import { SOURCES } from '@/lib/types';
import { prepareChartData, extractFilterOptions, normalizeAhrefsData } from '@/lib/data-utils';
import { parseAhrefsCSV, validateCSVFile, readFileAsText } from '@/lib/csv-parser';
import { SectionFilterPanel } from '@/components/filters/section-filter-panel';
import { PerformanceChart } from '@/components/charts/performance-chart';
import { TabbedDataTable } from '@/components/tables/tabbed-data-table';
import { GSCConnection } from '@/components/gsc/gsc-connection';
import { PerformanceClusters } from '@/components/clusters/performance-clusters';
import { useGSCData } from '@/hooks/useGSCData';
import { useGSC } from '@/contexts/GSCContext';
import { saveDataToStorage, loadDataFromStorage, hasStoredData, clearStoredData } from '@/lib/data-storage';

export default function Dashboard() {
  const [data, setData] = useState<NormalizedMetric[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Admin state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // GSC state
  const { selectedSite, isAuthenticated, checkAuthStatus, loadSites, sites } = useGSC();

  // Initialize GSC authentication status on mount
  useEffect(() => {
    const initGSCAuth = async () => {
      console.log('🔐 Initializing GSC auth status on main page...');
      await checkAuthStatus();
      // Load sites if authenticated
      if (isAuthenticated) {
        console.log('🔄 Loading sites since authenticated...');
        await loadSites();
      }
    };
    initGSCAuth();
  }, [checkAuthStatus, loadSites, isAuthenticated]);
  
  const [selectedChartMetrics, setSelectedChartMetrics] = useState<string[]>(['clicks']);

  // Remove 'volume' and 'traffic' from chart metrics if they exist (Ahrefs point-in-time data not suitable for time series)
  useEffect(() => {
    if (selectedChartMetrics.includes('volume') || selectedChartMetrics.includes('traffic')) {
      setSelectedChartMetrics(prev => prev.filter(metric => metric !== 'volume' && metric !== 'traffic'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove dependency to prevent infinite loop
  const [filters] = useState<FilterOptions>({
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

  // Fetch Quick Overview data - FAST aggregated totals (no dimensions)
  console.log('🚀 Quick View GSC Fetch (FAST MODE):', {
    isAuthenticated,
    selectedSite,
    sitesCount: sites?.length || 0,
    startDate: sectionFilters.quickView.dateRange.startDate,
    endDate: sectionFilters.quickView.dateRange.endDate,
    strategy: 'Aggregated totals only - no query breakdown',
    expectedSpeed: '~500ms instead of 5+ minutes',
    dateRangeDays: sectionFilters.quickView.dateRange.startDate && sectionFilters.quickView.dateRange.endDate 
      ? Math.ceil((new Date(sectionFilters.quickView.dateRange.endDate).getTime() - new Date(sectionFilters.quickView.dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0
  });
  
  const quickViewGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.quickView.dateRange.startDate,
    endDate: sectionFilters.quickView.dateRange.endDate,
    dimensions: ['date'], // Get daily data
    timeSeries: true, // Use time series endpoint
    enabled: !!(isAuthenticated && selectedSite && sectionFilters.quickView.dateRange.startDate && sectionFilters.quickView.dateRange.endDate),
    hookId: 'QUICK_VIEW'
  });

  // Table GSC Data Fetch - for detailed table view
  console.log('📊 Table GSC Fetch (DETAILED MODE):', {
    isAuthenticated,
    selectedSite,
    startDate: sectionFilters.table.dateRange.startDate,
    endDate: sectionFilters.table.dateRange.endDate,
    strategy: 'Top 1000 query+page combinations (same as GSC console)',
    expectedSpeed: '~2-3 seconds for top performers'
  });
  
  const tableGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.table.dateRange.startDate,
    endDate: sectionFilters.table.dateRange.endDate,
    dimensions: ['query', 'page'], // Include query AND page dimensions for table
    timeSeries: false,
    quickView: false, // Detailed mode for table
    enabled: !!(isAuthenticated && selectedSite && sectionFilters.table.dateRange.startDate && sectionFilters.table.dateRange.endDate),
    hookId: 'TABLE_PRIMARY'
  });

  // All-time GSC data for cluster cards (full 16 months - GSC API limit)
  const allTimeGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: getDateRangePreset('last_16_months').startDate, // Use full 16 months as "all-time"
    endDate: getDateRangePreset('last_16_months').endDate,
    dimensions: ['query', 'page'],
    timeSeries: false,
    quickView: false,
    enabled: !!(isAuthenticated && selectedSite),
    hookId: 'ALL_TIME_CLUSTERS'
  });

  // Comparison GSC data for Quick View comparison
  const comparisonGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.quickView.comparisonDateRange?.startDate,
    endDate: sectionFilters.quickView.comparisonDateRange?.endDate,
    dimensions: ['date'], // Get daily data
    timeSeries: true, // Use time series endpoint
    enabled: !!(
      isAuthenticated && 
      selectedSite && 
      sectionFilters.quickView.enableComparison &&
      sectionFilters.quickView.comparisonDateRange?.startDate && 
      sectionFilters.quickView.comparisonDateRange?.endDate
    ),
    hookId: 'QUICK_VIEW_COMPARISON'
  });

  // Chart GSC Data Fetch - for time-series chart visualization
  console.log('📈 Chart GSC Fetch (TIME-SERIES MODE):', {
    isAuthenticated,
    selectedSite,
    startDate: sectionFilters.chart.dateRange.startDate,
    endDate: sectionFilters.chart.dateRange.endDate,
    strategy: 'Daily time-series data for chart visualization',
    expectedSpeed: '~1-2 seconds for date range'
  });
  
  const chartGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.chart.dateRange.startDate,
    endDate: sectionFilters.chart.dateRange.endDate,
    dimensions: ['date'], // Date dimension for time-series
    timeSeries: true, // Enable time-series mode
    quickView: false,
    enabled: !!(isAuthenticated && selectedSite && sectionFilters.chart.dateRange.startDate && sectionFilters.chart.dateRange.endDate),
    hookId: 'CHART_PRIMARY'
  });

  // Chart Comparison GSC Data - for comparison mode in charts
  const chartComparisonGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.chart.comparisonDateRange?.startDate,
    endDate: sectionFilters.chart.comparisonDateRange?.endDate,
    dimensions: ['date'], // Date dimension for time-series
    timeSeries: true, // Enable time-series mode
    quickView: false,
    enabled: !!(
      isAuthenticated && 
      selectedSite && 
      sectionFilters.chart.enableComparison &&
      sectionFilters.chart.comparisonDateRange?.startDate && 
      sectionFilters.chart.comparisonDateRange?.endDate
    ),
    hookId: 'CHART_COMPARISON'
  });

  // Table Comparison GSC Data - for comparison mode in tables
  console.log('📊 Table Comparison GSC Fetch:', {
    isAuthenticated,
    selectedSite,
    enableComparison: sectionFilters.table.enableComparison,
    startDate: sectionFilters.table.comparisonDateRange?.startDate,
    endDate: sectionFilters.table.comparisonDateRange?.endDate,
    strategy: 'Query+page combinations for table comparison'
  });
  
  const tableComparisonGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.table.comparisonDateRange?.startDate,
    endDate: sectionFilters.table.comparisonDateRange?.endDate,
    dimensions: ['query', 'page'], // Include query AND page dimensions for table
    timeSeries: false,
    quickView: false, // Detailed mode for table
    enabled: !!(
      isAuthenticated && 
      selectedSite && 
      sectionFilters.table.enableComparison &&
      sectionFilters.table.comparisonDateRange?.startDate && 
      sectionFilters.table.comparisonDateRange?.endDate
    ),
    hookId: 'TABLE_COMPARISON'
  });

  // Debug: Log when Quick View filters change
  useEffect(() => {
    console.log('🔄 Quick View filters changed:', {
      startDate: sectionFilters.quickView.dateRange.startDate,
      endDate: sectionFilters.quickView.dateRange.endDate,
      enableComparison: sectionFilters.quickView.enableComparison,
      comparisonPreset: sectionFilters.quickView.comparisonPreset,
      dateRangeDays: sectionFilters.quickView.dateRange.startDate && sectionFilters.quickView.dateRange.endDate 
        ? Math.ceil((new Date(sectionFilters.quickView.dateRange.endDate).getTime() - new Date(sectionFilters.quickView.dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      gscDataCount: quickViewGSCData.data?.length || 0,
      gscLoading: quickViewGSCData.loading,
      gscError: quickViewGSCData.error
    });
  }, [
    sectionFilters.quickView.dateRange.startDate, 
    sectionFilters.quickView.dateRange.endDate,
    sectionFilters.quickView.enableComparison,
    sectionFilters.quickView.comparisonPreset,
    quickViewGSCData.data?.length,
    quickViewGSCData.loading,
    quickViewGSCData.error
  ]);

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

  // Calculate filtered data (for Ahrefs data only - GSC uses separate hooks)
  const filteredData = useMemo(() => {
    console.log('🔍 Filtering Ahrefs data with current filters:', {
      ahrefsItems: data.length,
      dateRange: filters.dateRange,
      ahrefsItemsWithDates: data.filter(item => item.source === SOURCES.AHREFS).map(item => ({
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
  // Legacy summaryStats - no longer used but kept for compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Derived data - legacy filter options, no longer used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const filterOptions = useMemo(() => extractFilterOptions(data), [data]); // Use all data for filter options

  // Section-specific filtered data - use appropriate GSC data sources
  const sectionFilteredData = useMemo(() => {
    return {
      quickView: quickViewGSCData.data || [], // Use live GSC data for Quick View
      table: tableGSCData.data || [], // Use live GSC data for Table
    };
  }, [quickViewGSCData.data, tableGSCData.data]);
  // Prepare chart data for multiple metrics using GSC data
  const chartData = useMemo(() => {
    console.log('📈 Preparing chart data:', {
      gscDataCount: chartGSCData.data?.length || 0,
      selectedMetrics: selectedChartMetrics,
      loading: chartGSCData.loading,
      error: chartGSCData.error
    });

    if (!chartGSCData.data || chartGSCData.data.length === 0) {
      return [];
    }

    const allChartData: ChartDataPoint[] = [];
      selectedChartMetrics.forEach(metric => {
      // Use GSC data for chart instead of Ahrefs data
      const metricData = prepareChartData(chartGSCData.data || [], metric, 'date');
      allChartData.push(...metricData);
    });
    
    console.log('📈 Chart data prepared:', {
      totalDataPoints: allChartData.length,
      sampleData: allChartData.slice(0, 3)
    });

    return allChartData;
  }, [chartGSCData.data, selectedChartMetrics, chartGSCData.loading, chartGSCData.error]);

  // Prepare chart comparison data
  const chartComparisonData = useMemo(() => {
    if (!sectionFilters.chart.enableComparison || !chartComparisonGSCData.data || chartComparisonGSCData.data.length === 0) {
      return [];
    }

    console.log('📈 Preparing chart comparison data:', {
      comparisonDataCount: chartComparisonGSCData.data.length,
      selectedMetrics: selectedChartMetrics
    });
    
    const allComparisonData: ChartDataPoint[] = [];
      selectedChartMetrics.forEach(metric => {
      const metricData = prepareChartData(chartComparisonGSCData.data || [], metric, 'date');
      allComparisonData.push(...metricData);
    });
    
    return allComparisonData;
  }, [chartComparisonGSCData.data, selectedChartMetrics, sectionFilters.chart.enableComparison, chartGSCData.loading]);

  // Section-specific summary stats for Quick Overview
  const quickViewStats = useMemo(() => {
    console.log('🔍 Calculating Quick Overview stats with new time-series method:', {
      gscData: quickViewGSCData.data?.length
    });

    // --- BUG HUNTING: Log the exact raw data being used ---
    console.log(
      'RAW DATA FOR QUICK VIEW STATS:', 
      JSON.stringify(quickViewGSCData.data, null, 2)
    );

    const stats = {
      totalClicks: 0,
      totalImpressions: 0,
      avgCTR: 0,
      avgPosition: 0,
    };

    if (!quickViewGSCData.data || quickViewGSCData.data.length === 0) {
      return stats;
    }

    // Sum up the daily data from the time-series
    quickViewGSCData.data.forEach(item => {
      stats.totalClicks += item.clicks || 0;
      stats.totalImpressions += item.impressions || 0;
    });

    // Calculate CTR and Position from the daily averages
    let positionSum = 0;
    let positionCount = 0;
    quickViewGSCData.data.forEach(item => {
      if (item.position && item.position > 0) {
        positionSum += item.position;
        positionCount++;
      }
    });

    stats.avgPosition = positionCount > 0 ? positionSum / positionCount : 0;
    stats.avgCTR = stats.totalImpressions > 0 ? stats.totalClicks / stats.totalImpressions : 0;
    
    console.log('📊 Quick Overview calculated stats:', stats);

    return stats;
  }, [quickViewGSCData.data]);

  // Comparison stats for Quick Overview (when comparison is enabled)
  const quickViewComparisonStats = useMemo(() => {
    if (!sectionFilters.quickView.enableComparison || !comparisonGSCData.data) {
      return null;
    }

    const previousStats = {
      totalClicks: 0,
      totalImpressions: 0,
      avgCTR: 0,
      avgPosition: 0,
    };

    comparisonGSCData.data.forEach(item => {
      previousStats.totalClicks += item.clicks || 0;
      previousStats.totalImpressions += item.impressions || 0;
    });
    
    let positionSum = 0;
    let positionCount = 0;
    comparisonGSCData.data.forEach(item => {
      if (item.position && item.position > 0) {
        positionSum += item.position;
        positionCount++;
      }
    });

    previousStats.avgPosition = positionCount > 0 ? positionSum / positionCount : 0;
    previousStats.avgCTR = previousStats.totalImpressions > 0 ? previousStats.totalClicks / previousStats.totalImpressions : 0;

    // Calculate percentage changes
    const changes = {
      clicksChange: previousStats.totalClicks > 0 ?
        Math.round(((quickViewStats.totalClicks - previousStats.totalClicks) / previousStats.totalClicks) * 100) : 0,
      impressionsChange: previousStats.totalImpressions > 0 ?
        Math.round(((quickViewStats.totalImpressions - previousStats.totalImpressions) / previousStats.totalImpressions) * 100) : 0,
      ctrChange: previousStats.avgCTR > 0 ?
        Math.round(((quickViewStats.avgCTR - previousStats.avgCTR) / previousStats.avgCTR) * 100) : 0,
      positionChange: previousStats.avgPosition > 0 ?
        Math.round(((previousStats.avgPosition - quickViewStats.avgPosition) / previousStats.avgPosition) * 100) : 0, // Note: lower position is better
    };

    console.log('📈 Comparison results:', {
      current: quickViewStats,
      previous: previousStats,
      changes,
    });

    return { current: quickViewStats, previous: previousStats, changes };
  }, [quickViewStats, sectionFilters.quickView.enableComparison, comparisonGSCData.data]);

  // Prepare separate data for tabbed tables
  const ahrefsTableData = useMemo(() => {
    return data.filter(item => item.source === SOURCES.AHREFS);
  }, [data]);

  // Prepare Ahrefs comparison data by filtering by date ranges
  const ahrefsComparisonData = useMemo(() => {
    // For Ahrefs, each row already contains comparison data (traffic vs previousTraffic)
    // We don't need to filter by date ranges like GSC data
    console.log('🔍 Ahrefs Comparison Data Prepared:', {
      enableComparison: sectionFilters.table.enableComparison,
      totalAhrefsData: ahrefsTableData.length,
      sampleData: ahrefsTableData.slice(0, 3).map(item => ({
        query: item.query,
        traffic: item.traffic,
        previousTraffic: item.previousTraffic,
        hasComparisonData: !!(item.traffic && item.previousTraffic)
      }))
    });

    // Return all Ahrefs data for comparison table - it will use built-in previousTraffic/previousPosition
    return { current: ahrefsTableData, comparison: [] };
  }, [ahrefsTableData, sectionFilters.table.enableComparison]);

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

  // Admin functions
  const handleLogin = () => {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'sdmedcerts-2025';
    if (loginPassword === adminPassword) {
      setIsAdminMode(true);
      setShowLoginModal(false);
      setLoginPassword('');
      setLoginError('');
    } else {
      setLoginError('Invalid password');
    }
  };

  const handleLogout = () => {
    setIsAdminMode(false);
  };

  const handleLoginKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Image 
                src="/medcerts-logo.svg" 
                alt="MedCerts Logo" 
                width={240} 
                height={60}
                className="h-16 w-auto"
              />
              <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Medcert.com Performance Metrics Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {!isAdminMode ? (
                <Button 
                  onClick={() => setShowLoginModal(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </Button>
              ) : (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Admin Mode
                  </span>
                  <Button 
                    onClick={handleLogout}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Introduction Text */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Below you can view the performance data of Medcerts.com. The data is aggregated from best in class organic data sources to provide relevant performance markers across time.
            <br />
            Simply use the data and comparison filters to view performance metrics.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Sources Section - Admin Only */}
        {isAdminMode && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Data Sources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Google Search Console */}
            <GSCConnection />

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
        )}

        {/* Data Status - Admin Only */}
        {isAdminMode && data.length > 0 && (
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
                {new Date(sectionFilters.quickView.dateRange.startDate).toISOString().split('T')[0]} - {new Date(sectionFilters.quickView.dateRange.endDate).toISOString().split('T')[0]}
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
            comparisonData={chartComparisonData}
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
            loading={chartGSCData.loading}
            error={chartGSCData.error}
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
                  {new Date(sectionFilters.table.dateRange.startDate).toISOString().split('T')[0]} - {new Date(sectionFilters.table.dateRange.endDate).toISOString().split('T')[0]}
                </span>
              </div>
              
              {/* Tabbed Table content */}
              <TabbedDataTable
                data={ahrefsTableData}
                gscData={tableGSCData.data}
                gscComparisonData={tableComparisonGSCData.data} // Now using actual comparison data
                ahrefsCurrentPeriodData={ahrefsComparisonData.current}
                ahrefsComparisonData={ahrefsComparisonData.comparison} // Now using actual Ahrefs comparison data
                fullData={data}
            loading={loading}
                gscLoading={tableGSCData.loading}
                gscError={tableGSCData.error}
            sectionFilters={sectionFilters.table}
            onSectionFiltersChange={(newFilters) => 
              setSectionFilters(prev => ({ ...prev, table: newFilters }))
            }
          />
            </CardContent>
          </Card>

          {/* Performance Clusters */}
          <PerformanceClusters
            data={filteredData} // Ahrefs data
            gscData={allTimeGSCData.data} // All-time GSC data for main page cluster cards
            filteredGscData={tableGSCData.data} // Filtered GSC data for modal comparison mode
            filters={filters}
          />
        </div>
      </main>

      {/* Admin Login Modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Login</DialogTitle>
            <DialogDescription>
              Enter the admin password to access data management features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={handleLoginKeyPress}
                placeholder="Enter admin password"
                className={loginError ? 'border-red-500' : ''}
              />
              {loginError && (
                <p className="text-sm text-red-500">{loginError}</p>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginPassword('');
                  setLoginError('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleLogin}>
                Login
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}