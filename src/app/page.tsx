'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, BarChart3, TrendingUp } from 'lucide-react';
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
    dimensions: [], // No dimensions for aggregated totals
    timeSeries: false,
    quickView: true, // FAST mode for quick overview
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
    dimensions: [], // No dimensions for aggregated totals
    timeSeries: false,
    quickView: true, // FAST mode for quick overview
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
  }, [chartComparisonGSCData.data, selectedChartMetrics, sectionFilters.chart.enableComparison, chartComparisonGSCData.loading]);

  // Section-specific summary stats for Quick Overview
  const quickViewStats = useMemo(() => {
    console.log('🔍 Calculating Quick Overview stats for date range:', {
    startDate: sectionFilters.quickView.dateRange.startDate,
    endDate: sectionFilters.quickView.dateRange.endDate,
      dataPoints: sectionFilteredData.quickView.length,
      sampleData: sectionFilteredData.quickView.slice(0, 3),
      comparisonEnabled: sectionFilters.quickView.enableComparison,
      comparisonPreset: sectionFilters.quickView.comparisonPreset,
      totalDataPoints: data.length,
      dateRangeInDays: Math.ceil((new Date(sectionFilters.quickView.dateRange.endDate).getTime() - new Date(sectionFilters.quickView.dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24))
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
    
    // Calculate Average Position correctly according to GSC methodology
    // GSC methodology: "topmost position... averaged across all impressions"
    
    console.log('🔍 Quick Overview position debugging:', {
      totalDataPoints: sectionFilteredData.quickView.length,
      gscDataPoints: sectionFilteredData.quickView.filter(item => item.source === SOURCES.GSC).length,
      sampleGSCData: sectionFilteredData.quickView.filter(item => item.source === SOURCES.GSC).slice(0, 3).map(item => ({
        date: item.date,
        source: item.source,
        position: item.position,
        query: item.query?.substring(0, 20)
      })),
      dateRangeCheck: {
        filterStart: sectionFilters.quickView.dateRange.startDate,
        filterEnd: sectionFilters.quickView.dateRange.endDate,
        actualDateRange: {
          earliest: sectionFilteredData.quickView.length > 0 ? Math.min(...sectionFilteredData.quickView.map(item => new Date(item.date).getTime())) : null,
          latest: sectionFilteredData.quickView.length > 0 ? Math.max(...sectionFilteredData.quickView.map(item => new Date(item.date).getTime())) : null
        }
      }
    });
    
    if (sectionFilteredData.quickView.length > 0) {
      const actualEarliest = new Date(Math.min(...sectionFilteredData.quickView.map(item => new Date(item.date).getTime()))).toISOString().split('T')[0];
      const actualLatest = new Date(Math.max(...sectionFilteredData.quickView.map(item => new Date(item.date).getTime()))).toISOString().split('T')[0];
      console.log('📅 Actual date range in filtered data:', {
        earliest: actualEarliest,
        latest: actualLatest,
        expectedStart: sectionFilters.quickView.dateRange.startDate,
        expectedEnd: sectionFilters.quickView.dateRange.endDate,
        matchesExpected: actualEarliest === sectionFilters.quickView.dateRange.startDate && actualLatest === sectionFilters.quickView.dateRange.endDate
      });
    }

    // For Quick View, we use aggregated GSC data (no dimensions), which returns totals for the entire period
    // This data will have the end date assigned to it, which is correct for aggregated metrics
    const gscTimeSeriesData = sectionFilteredData.quickView.filter(item => 
      item.source === SOURCES.GSC && 
      (item.query === 'Total' || item.query === '' || !item.query)
    );
    
    console.log('📊 GSC aggregated data for Quick View:', {
      totalRows: gscTimeSeriesData.length,
      sampleData: gscTimeSeriesData.slice(0, 2),
      explanation: 'Aggregated GSC data represents totals for the entire date range, assigned to end date'
    });
    
    const gscQueryData = sectionFilteredData.quickView.filter(item => 
      item.source === SOURCES.GSC && 
      item.query && 
      item.query !== 'Total' && 
      item.query !== ''
    );
    
    const ahrefsData = sectionFilteredData.quickView.filter(item => item.source === SOURCES.AHREFS);
    
    console.log('📊 Data breakdown for Quick Overview:', {
      gscTimeSeries: gscTimeSeriesData.length,
      gscQueryLevel: gscQueryData.length, 
      ahrefs: ahrefsData.length,
      total: sectionFilteredData.quickView.length,
      sampleTimeSeries: gscTimeSeriesData.slice(0, 3).map(item => ({
        date: item.date,
        clicks: item.clicks,
        impressions: item.impressions,
        query: item.query || 'Total'
      }))
    });

    // Calculate totals from GSC time series data (daily aggregates)
    gscTimeSeriesData.forEach(item => {
      stats.totalClicks += item.clicks || 0;
      stats.totalImpressions += item.impressions || 0;
    });
    
    // Add Ahrefs data for volume and traffic
    ahrefsData.forEach(item => {
      stats.totalVolume += item.volume || 0;
      stats.totalTraffic += item.traffic || 0;
    });

    // Calculate Average Position from query-level GSC data (using correct methodology)
    // Check date distribution in query-level data
    const queryDataDates = new Map<string, number>();
    gscQueryData.forEach(item => {
      const count = queryDataDates.get(item.date) || 0;
      queryDataDates.set(item.date, count + 1);
    });
    
    const timeSeriesDataDates = new Map<string, number>();
    gscTimeSeriesData.forEach(item => {
      const count = timeSeriesDataDates.get(item.date) || 0;
      timeSeriesDataDates.set(item.date, count + 1);
    });

    console.log('🎯 Average Position debugging:', {
      gscQueryDataCount: gscQueryData.length,
      gscQueryDataSample: gscQueryData.slice(0, 5).map(item => ({
        query: item.query?.substring(0, 30),
        position: item.position,
        date: item.date,
        hasPosition: !!item.position,
        positionType: typeof item.position,
        positionValue: item.position
      })),
      queryDataDateDistribution: Object.fromEntries(queryDataDates.entries()),
      timeSeriesDateDistribution: Object.fromEntries(timeSeriesDataDates.entries()),
      dateRangeFilter: {
        start: sectionFilters.quickView.dateRange.startDate,
        end: sectionFilters.quickView.dateRange.endDate,
        daysInRange: Math.ceil((new Date(sectionFilters.quickView.dateRange.endDate).getTime() - new Date(sectionFilters.quickView.dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24))
      }
    });

    // GSC Average Position: "topmost position... averaged across all impressions"
    // Each data point represents an impression, so we need to average across all impressions
    const allImpressionPositions: number[] = [];
    
    gscQueryData.forEach((item, index) => {
      if (item.position && item.position > 0 && item.query && item.impressions && item.impressions > 0) {
        // Each item represents impressions for a query on a specific date
        // We should weight the position by the number of impressions
        // But since we don't have individual impression positions, we use the position for all impressions of this query/date
        for (let i = 0; i < item.impressions; i++) {
          allImpressionPositions.push(item.position);
        }
        
        // Debug first few position entries
        if (index < 5) {
          console.log(`📊 Position entry ${index}:`, {
            query: item.query?.substring(0, 30),
            position: item.position,
            impressions: item.impressions,
            contributedPositions: item.impressions,
            date: item.date,
            source: item.source
          });
        }
      } else if (index < 5) {
        console.log(`⚠️ GSC query item without valid position/impressions:`, {
          position: item.position,
          impressions: item.impressions,
          query: item.query?.substring(0, 20),
          date: item.date,
          hasPosition: !!item.position,
          hasImpressions: !!item.impressions,
          positionValue: item.position,
          hasQuery: !!item.query,
          positionType: typeof item.position
        });
      }
    });

    // Calculate average position across all impressions (true GSC methodology)
    stats.avgPosition = allImpressionPositions.length > 0 
      ? allImpressionPositions.reduce((sum, pos) => sum + pos, 0) / allImpressionPositions.length 
      : 0;
      
    console.log('🎯 Average Position calculation result:', {
      totalImpressionPositions: allImpressionPositions.length,
      calculatedAvgPosition: stats.avgPosition,
      hasValidPosition: stats.avgPosition > 0,
      samplePositions: allImpressionPositions.slice(0, 20), // Show first 20 impression positions
      uniquePositionValues: [...new Set(allImpressionPositions)].sort((a, b) => a - b).slice(0, 10)
    });
    
    // Check if we have sufficient date coverage for position data
    const dateRangeStart = new Date(sectionFilters.quickView.dateRange.startDate);
    const dateRangeEnd = new Date(sectionFilters.quickView.dateRange.endDate);
    const totalDaysInRange = Math.ceil((dateRangeEnd.getTime() - dateRangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysWithQueryData = queryDataDates.size;
    const coveragePercentage = (daysWithQueryData / totalDaysInRange) * 100;
    
    console.log('📊 Position data coverage analysis:', {
      totalDaysInRange,
      daysWithQueryData,
      coveragePercentage: coveragePercentage.toFixed(1) + '%',
      sufficientCoverage: coveragePercentage >= 10, // At least 10% coverage
      queryDataDates: Array.from(queryDataDates.keys()).sort()
    });
    
    // If we have very limited date coverage, use a different approach
    if (coveragePercentage < 10 && stats.avgPosition > 0) {
      console.log('⚠️ Limited position data coverage, using time-weighted approach...');
      
      // Group position data by date and calculate daily averages
      const dailyPositions = new Map<string, number[]>();
      sectionFilteredData.quickView.forEach(item => {
        if (item.source === SOURCES.GSC && item.position && item.position > 0) {
          const positions = dailyPositions.get(item.date) || [];
          positions.push(item.position);
          dailyPositions.set(item.date, positions);
        }
      });
      
      // Calculate average position across all available dates
      let totalWeightedPosition = 0;
      let totalWeight = 0;
      
      dailyPositions.forEach((positions, date) => {
        const dailyAvg = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
        totalWeightedPosition += dailyAvg * positions.length; // Weight by number of queries
        totalWeight += positions.length;
      });
      
      if (totalWeight > 0) {
        const timeWeightedAvgPosition = totalWeightedPosition / totalWeight;
        console.log('🔄 Time-weighted position calculation:', {
          originalAvgPosition: stats.avgPosition,
          timeWeightedAvgPosition,
          datesWithData: dailyPositions.size,
          totalDataPoints: totalWeight,
          dailyAverages: Object.fromEntries(
            Array.from(dailyPositions.entries()).map(([date, positions]) => [
              date, 
              (positions.reduce((sum, pos) => sum + pos, 0) / positions.length).toFixed(2)
            ])
          )
        });
        
        // Use time-weighted average if it's significantly different
        stats.avgPosition = timeWeightedAvgPosition;
      }
    }
    
    // FALLBACK: If no position data at all, try using any GSC position data available
    if (stats.avgPosition === 0) {
      console.log('⚠️ No position data found, trying final fallback...');
      
      const allGSCPositions: number[] = [];
      sectionFilteredData.quickView.forEach(item => {
        if (item.source === SOURCES.GSC && item.position && item.position > 0) {
          allGSCPositions.push(item.position);
        }
      });
      
      if (allGSCPositions.length > 0) {
        stats.avgPosition = allGSCPositions.reduce((sum, pos) => sum + pos, 0) / allGSCPositions.length;
        console.log('🔄 Final fallback position calculation:', {
          positionDataPoints: allGSCPositions.length,
          positions: allGSCPositions.slice(0, 10),
          fallbackAvgPosition: stats.avgPosition
        });
      } else {
        console.log('❌ No position data found in any GSC data');
      }
    }
    
    // Calculate CTR from filtered data: CTR = Total Clicks / Total Impressions
    stats.avgCTR = stats.totalImpressions > 0 ? stats.totalClicks / stats.totalImpressions : 0;

    console.log('📊 Quick Overview calculated stats:', {
      totalClicks: stats.totalClicks,
      totalImpressions: stats.totalImpressions,
      calculatedCTR: stats.avgCTR,
      calculatedCTRPercent: (stats.avgCTR * 100).toFixed(2) + '%',
      avgPosition: stats.avgPosition.toFixed(2),
      dataSourceBreakdown: {
        clicksFrom: 'GSC Time Series',
        impressionsFrom: 'GSC Time Series', 
        ctrFrom: 'Calculated (Clicks/Impressions)',
        positionFrom: 'GSC Query Data (Weighted by impressions)',
        timeSeriesDataPoints: gscTimeSeriesData.length,
        queryDataPoints: gscQueryData.length,
        totalImpressionPositions: allImpressionPositions.length
      },
      totalGSCDataPoints: sectionFilteredData.quickView.filter(item => item.source === SOURCES.GSC).length
    });

    return stats;
  }, [sectionFilteredData.quickView, sectionFilters.quickView.dateRange, sectionFilters.quickView.enableComparison, sectionFilters.quickView.comparisonPreset, data.length]);

  // Comparison stats for Quick Overview (when comparison is enabled)
  const quickViewComparisonStats = useMemo(() => {
    if (!sectionFilters.quickView.enableComparison || !sectionFilters.quickView.comparisonDateRange) {
      return null;
    }

    console.log('🔍 Calculating Quick Overview comparison stats for:', {
      primaryRange: `${sectionFilters.quickView.dateRange.startDate} to ${sectionFilters.quickView.dateRange.endDate}`,
      comparisonRange: `${sectionFilters.quickView.comparisonDateRange.startDate} to ${sectionFilters.quickView.comparisonDateRange.endDate}`
    });

    // Check if comparison period is within available data range
    const allDates = data.map(item => new Date(item.date)).sort((a, b) => a.getTime() - b.getTime());
    const earliestDataDate = allDates[0];
    const comparisonStart = new Date(sectionFilters.quickView.comparisonDateRange.startDate);
    
    if (earliestDataDate && comparisonStart < earliestDataDate) {
      console.warn('⚠️ Comparison period extends before available data:', {
        comparisonStart: comparisonStart.toISOString().split('T')[0],
        earliestData: earliestDataDate.toISOString().split('T')[0],
        daysBefore: Math.ceil((earliestDataDate.getTime() - comparisonStart.getTime()) / (1000 * 60 * 60 * 24))
      });
    }

    // Use dedicated comparison GSC data
    const comparisonData = comparisonGSCData.data || [];
    
    console.log('🔍 Comparison GSC data fetch status:', {
      loading: comparisonGSCData.loading,
      error: comparisonGSCData.error,
      dataCount: comparisonData.length,
      comparisonDateRange: sectionFilters.quickView.comparisonDateRange
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

    // Separate GSC time series data (for totals) from query-level data (for averages) - COMPARISON PERIOD
    const comparisonGscTimeSeriesData = comparisonData.filter(item => 
      item.source === SOURCES.GSC && 
      (item.query === 'Total' || item.query === '' || !item.query)
    );
    
    const comparisonGscQueryData = comparisonData.filter(item => 
      item.source === SOURCES.GSC && 
      item.query && 
      item.query !== 'Total' && 
      item.query !== ''
    );
    
    console.log('📊 Comparison data breakdown:', {
      gscTimeSeries: comparisonGscTimeSeriesData.length,
      gscQueryLevel: comparisonGscQueryData.length,
      total: comparisonData.length,
      sampleTimeSeries: comparisonGscTimeSeriesData.slice(0, 3).map(item => ({
        date: item.date,
        clicks: item.clicks,
        impressions: item.impressions,
        query: item.query || 'Total'
      }))
    });

    // Calculate totals from GSC time series data (daily aggregates) - COMPARISON PERIOD
    comparisonGscTimeSeriesData.forEach(item => {
      comparisonStats.totalClicks += item.clicks || 0;
      comparisonStats.totalImpressions += item.impressions || 0;
    });

    // Calculate Average Position for comparison period using true GSC methodology
    // GSC Average Position: "topmost position... averaged across all impressions"
    const comparisonImpressionPositions: number[] = [];

    comparisonGscQueryData.forEach(item => {
      // Only use GSC query data for position calculation - weight by impressions
      if (item.position && item.position > 0 && item.query && item.impressions && item.impressions > 0) {
        // Each item represents impressions for a query on a specific date
        // Weight the position by the number of impressions
        for (let i = 0; i < item.impressions; i++) {
          comparisonImpressionPositions.push(item.position);
        }
      }
    });

    // Calculate comparison period average position across all impressions (true GSC methodology)
    comparisonStats.avgPosition = comparisonImpressionPositions.length > 0 
      ? comparisonImpressionPositions.reduce((sum, pos) => sum + pos, 0) / comparisonImpressionPositions.length 
      : 0;
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
      changes,
      comparisonImpressionPositions: comparisonImpressionPositions.length,
      comparisonSamplePositions: comparisonImpressionPositions.slice(0, 10)
    });

    return { current: quickViewStats, previous: comparisonStats, changes };
  }, [quickViewStats, sectionFilters.quickView.enableComparison, sectionFilters.quickView.comparisonDateRange, sectionFilters.quickView.dateRange.startDate, sectionFilters.quickView.dateRange.endDate, data, filters.sources]);

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
    </div>
  );
}