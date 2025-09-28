'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PerformanceChart } from '@/components/charts/performance-chart';
import { TabbedDataTable } from '@/components/tables/tabbed-data-table';
import { SectionFilterPanel } from '@/components/filters/section-filter-panel';
import { BarChart3, TrendingUp, TrendingDown, Globe, ArrowUpDown } from 'lucide-react';
import { PerformanceCluster, NormalizedMetric, FilterOptions, ComparisonPreset, ChartDataPoint, SectionFilters } from '@/lib/types';
import { prepareTableData, getGSCComparisonRanges, getDateRangePreset } from '@/lib/data-utils';
import { useGSCData } from '@/hooks/useGSCData';
import { useGSC } from '@/contexts/GSCContext';

interface ClusterDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: PerformanceCluster | null;
  data: NormalizedMetric[];
  gscData?: NormalizedMetric[]; // Filtered GSC data for comparison mode
  allTimeGscData?: NormalizedMetric[]; // All-time GSC data for non-comparison mode
  filters: FilterOptions;
}

export function ClusterDetailModal({ 
  open, 
  onOpenChange, 
  cluster, 
  data,
  gscData,
  allTimeGscData,
  filters
}: ClusterDetailModalProps) {
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [selectedChartMetrics, setSelectedChartMetrics] = useState<string[]>(['clicks']);
  const [activeUrlTab, setActiveUrlTab] = useState<string>('');
  
  // DEPRECATED - using sectionFilters now
  const [enableComparison, setEnableComparison] = useState(false);
  const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset>('last_30d_vs_previous');
  
  // Section filters for cluster summary (similar to Quick View)
  const [sectionFilters, setSectionFilters] = useState<SectionFilters>({
    dateRange: getDateRangePreset('last_30_days'),
    enableComparison: false,
  });

  // Get GSC context for live data fetching
  const { selectedSite, isAuthenticated } = useGSC();

  // Initialize selected URLs when cluster changes
  useEffect(() => {
    if (cluster) {
      setSelectedUrls(cluster.urls);
      // Set first URL as active tab
      if (cluster.urls.length > 0 && !activeUrlTab) {
        setActiveUrlTab(cluster.urls[0]);
      }
    }
  }, [cluster, activeUrlTab]);

  // Calculate comparison date ranges for old comparison system - DEPRECATED
  const comparisonDateRanges = useMemo(() => {
    if (!enableComparison) return null;
    
    return getGSCComparisonRanges(comparisonPreset);
  }, [enableComparison, comparisonPreset]);

  // GSC data fetch for cluster summary (based on section filters)
  const clusterSummaryGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.dateRange.startDate,
    endDate: sectionFilters.dateRange.endDate,
    dimensions: ['query', 'page'],
    timeSeries: false,
    quickView: false,
    enabled: !!(isAuthenticated && selectedSite && sectionFilters.dateRange.startDate && sectionFilters.dateRange.endDate),
    hookId: 'CLUSTER_SUMMARY'
  });

  // GSC data fetch for cluster summary comparison (if enabled)
  const clusterSummaryComparisonGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.comparisonDateRange?.startDate,
    endDate: sectionFilters.comparisonDateRange?.endDate,
    dimensions: ['query', 'page'],
    timeSeries: false,
    quickView: false,
    enabled: !!(
      isAuthenticated && 
      selectedSite && 
      sectionFilters.enableComparison &&
      sectionFilters.comparisonDateRange?.startDate && 
      sectionFilters.comparisonDateRange?.endDate
    ),
    hookId: 'CLUSTER_SUMMARY_COMPARISON'
  });

  // GSC data fetch for URL tables (based on section filters)
  const urlTableGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.dateRange.startDate,
    endDate: sectionFilters.dateRange.endDate,
    dimensions: ['query', 'page'],
    timeSeries: false,
    quickView: false,
    enabled: !!(isAuthenticated && selectedSite && sectionFilters.dateRange.startDate && sectionFilters.dateRange.endDate),
    hookId: 'CLUSTER_URL_TABLES'
  });

  // GSC data fetch for URL tables comparison (if enabled)
  const urlTableComparisonGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.comparisonDateRange?.startDate,
    endDate: sectionFilters.comparisonDateRange?.endDate,
    dimensions: ['query', 'page'],
    timeSeries: false,
    quickView: false,
    enabled: !!(
      isAuthenticated && 
      selectedSite && 
      sectionFilters.enableComparison &&
      sectionFilters.comparisonDateRange?.startDate && 
      sectionFilters.comparisonDateRange?.endDate
    ),
    hookId: 'CLUSTER_URL_TABLES_COMPARISON'
  });

  // Fetch live GSC data for current period (when comparison is enabled)
  const currentPeriodGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: comparisonDateRanges?.primary?.startDate,
    endDate: comparisonDateRanges?.primary?.endDate,
    dimensions: ['query', 'page'],
    timeSeries: false,
    enabled: !!(
      enableComparison && 
      isAuthenticated && 
      selectedSite && 
      comparisonDateRanges?.primary?.startDate && 
      comparisonDateRanges?.primary?.endDate
    ),
    hookId: 'CLUSTER_CURRENT'
  });

  // Fetch live GSC data for comparison period
  const comparisonPeriodGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: comparisonDateRanges?.comparison?.startDate,
    endDate: comparisonDateRanges?.comparison?.endDate,
    dimensions: ['query', 'page'],
    timeSeries: false,
    enabled: !!(
      enableComparison && 
      isAuthenticated && 
      selectedSite &&
      comparisonDateRanges?.comparison?.startDate && 
      comparisonDateRanges?.comparison?.endDate
    ),
    hookId: 'CLUSTER_COMPARISON'
  });

  // Chart-specific GSC data fetches (with date AND page dimensions for URL filtering) - UPDATED to use sectionFilters
  const chartCurrentPeriodGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.dateRange.startDate,
    endDate: sectionFilters.dateRange.endDate,
    dimensions: ['date', 'page'], // Include both date and page for time series + URL filtering
    timeSeries: true,
    quickView: false,
    enabled: !!(isAuthenticated && selectedSite && sectionFilters.dateRange.startDate && sectionFilters.dateRange.endDate),
    hookId: 'CLUSTER_CHART_CURRENT'
  });

  const chartComparisonPeriodGSCData = useGSCData({
    siteUrl: selectedSite || undefined,
    startDate: sectionFilters.comparisonDateRange?.startDate,
    endDate: sectionFilters.comparisonDateRange?.endDate,
    dimensions: ['date', 'page'], // Include both date and page for time series + URL filtering
    timeSeries: true,
    quickView: false,
    enabled: !!(
      sectionFilters.enableComparison && 
      isAuthenticated && 
      selectedSite &&
      sectionFilters.comparisonDateRange?.startDate && 
      sectionFilters.comparisonDateRange?.endDate
    ),
    hookId: 'CLUSTER_CHART_COMPARISON'
  });

  // Filter data for the cluster URLs and selected URLs
  const clusterData = useMemo(() => {
    if (!cluster) return [];
    
    // Choose GSC data source based on comparison mode
    const gscDataSource = enableComparison 
      ? (gscData || [])       // Comparison mode: use filtered GSC data
      : (allTimeGscData || []); // Non-comparison mode: use all-time GSC data
    
    // Combine appropriate GSC data with Ahrefs data
    const allData = [
      ...gscDataSource, // GSC data (all-time or filtered based on mode)
      ...data.filter(item => item.source === 'ahrefs') // Ahrefs data
    ];
    
    console.log('🔍 ClusterData source (mode-based):', {
      enableComparison,
      dataSource: enableComparison ? 'Filtered GSC' : 'All-time GSC',
      originalDataCount: data.length,
      filteredGscCount: (gscData || []).length,
      allTimeGscCount: (allTimeGscData || []).length,
      selectedGscCount: gscDataSource.length,
      totalDataCount: allData.length,
      selectedUrls: selectedUrls,
      clusterUrls: cluster.urls,
      gscSample: gscDataSource.slice(0, 5).map(item => ({
        url: item.url,
        clicks: item.clicks,
        impressions: item.impressions,
        source: item.source,
        date: item.date,
        urlMatchesCluster: item.url && cluster.urls.some(url => 
          item.url!.toLowerCase().includes(url.toLowerCase()) || 
          url.toLowerCase().includes(item.url!.toLowerCase())
        )
      })),
      totalClicksInData: allData.reduce((sum, item) => sum + (item.clicks || 0), 0),
      totalClicksInGscData: gscDataSource.reduce((sum, item) => sum + (item.clicks || 0), 0),
      gscDataWithClicks: gscDataSource.filter(item => item.clicks && item.clicks > 0).length
    });
    
    const filteredData = allData.filter(item => {
      // Must match cluster URLs (source filtering already done above)
      const urlMatch = item.url && cluster.urls.some(url => 
        item.url!.toLowerCase().includes(url.toLowerCase()) || 
        url.toLowerCase().includes(item.url!.toLowerCase())
      );

      if (!urlMatch && item.source === 'gsc' && item.clicks && item.clicks > 0) {
        console.log('🔍 GSC item filtered out:', {
          url: item.url,
          clicks: item.clicks,
          source: item.source,
          urlMatch,
          clusterUrls: cluster.urls,
          itemUrl: item.url,
          date: item.date
        });
      }

      return urlMatch;
    });
    
    console.log('🔍 ClusterData result:', {
      enableComparison,
      totalItems: filteredData.length,
      totalClicks: filteredData.reduce((sum, item) => sum + (item.clicks || 0), 0),
      totalImpressions: filteredData.reduce((sum, item) => sum + (item.impressions || 0), 0),
      gscItemsInFiltered: filteredData.filter(item => item.source === 'gsc').length,
      gscClicksInFiltered: filteredData.filter(item => item.source === 'gsc').reduce((sum, item) => sum + (item.clicks || 0), 0),
      ahrefsItemsInFiltered: filteredData.filter(item => item.source === 'ahrefs').length,
      filteredSample: filteredData.slice(0, 5).map(item => ({
        url: item.url,
        clicks: item.clicks,
        impressions: item.impressions,
        source: item.source,
        date: item.date
      })),
      comparisonPreset
    });
    
    return filteredData;
  }, [cluster, data, gscData, allTimeGscData, filters, selectedUrls, enableComparison, currentPeriodGSCData.data]);

  // Filter comparison data
  const comparisonClusterData = useMemo(() => {
    if (!cluster || !enableComparison || !comparisonPeriodGSCData.data) return [];
    
    // Use live comparison GSC data
    const sourceGSCData = comparisonPeriodGSCData.data;
    
    // Combine GSC data (with clicks) and Ahrefs data (with traffic/volume) for comparison
    const allData = [
      ...sourceGSCData, // Live comparison GSC data with clicks
      ...data.filter(item => item.source === 'ahrefs') // Ahrefs data (though not useful for comparison)
    ];
    
    console.log('🔍 Comparison data filtering:', {
      comparisonRange: comparisonDateRanges?.comparison,
      totalDataBeforeFilter: allData.length,
      gscComparisonDataCount: sourceGSCData.length,
      selectedUrls,
      enableComparison
    });
    
    const filteredData = allData.filter(item => {
      // Must be from selected sources
      const sourceMatch = filters.sources.includes(item.source);

      // Must match selected URLs
      const urlMatch = item.url && selectedUrls.some(url => 
        item.url!.toLowerCase().includes(url.toLowerCase()) || 
        url.toLowerCase().includes(item.url!.toLowerCase())
      );

      return sourceMatch && urlMatch;
    });

    console.log('🔍 Comparison data result:', {
      totalItems: filteredData.length,
      totalClicks: filteredData.reduce((sum, item) => sum + (item.clicks || 0), 0),
      dateRange: comparisonDateRanges?.comparison
    });

    return filteredData;
  }, [cluster, data, filters, selectedUrls, enableComparison, comparisonPeriodGSCData.data, comparisonDateRanges]);

  // Convert chart GSC data to chart format (use dedicated chart data) - UPDATED to use sectionFilters
  const chartData = useMemo(() => {
    // Always use dedicated chart GSC data (time-series data with date dimension)
    const chartGSCData = chartCurrentPeriodGSCData.data || [];
    console.log('📊 Converting chart GSC data to chart format:', {
      rawDataLength: chartGSCData.length,
      sampleData: chartGSCData.slice(0, 3),
      selectedMetrics: selectedChartMetrics,
      enableComparison: sectionFilters.enableComparison,
      usingDedicatedChartData: true,
      uniqueDates: [...new Set(chartGSCData.map(d => d.date))].length
    });

    const allChartData: ChartDataPoint[] = [];
    
    // Filter data for cluster URLs first
    const filteredChartData = chartGSCData.filter(item => 
      item.url && cluster?.urls.some(url => 
        item.url!.toLowerCase().includes(url.toLowerCase()) || 
        url.toLowerCase().includes(item.url!.toLowerCase())
      )
    );
    
    // Convert each GSC data point to chart format for each selected metric
    filteredChartData.forEach(item => {
    selectedChartMetrics.forEach(metric => {
        if (item[metric as keyof typeof item] !== undefined && item.date) {
          allChartData.push({
            date: item.date,
            metric: metric,
            value: Number(item[metric as keyof typeof item]) || 0,
            source: 'gsc'
          });
        }
      });
    });

    console.log('📊 Chart data converted:', {
      inputGSCData: chartGSCData.length,
      filteredGSCData: filteredChartData.length,
      outputChartData: allChartData.length,
      selectedMetrics: selectedChartMetrics,
      sampleChartData: allChartData.slice(0, 3),
      uniqueDates: [...new Set(allChartData.map(d => d.date))].length
    });

    return allChartData;
  }, [chartCurrentPeriodGSCData.data, selectedChartMetrics, cluster, sectionFilters.enableComparison]);

  // Convert chart comparison GSC data to chart format (same approach as main page) - UPDATED to use sectionFilters
  const chartComparisonData = useMemo(() => {
    const gscComparisonData = chartComparisonPeriodGSCData.data || [];
    console.log('📊 Converting chart comparison GSC data to chart format:', {
      rawDataLength: gscComparisonData.length,
      sampleData: gscComparisonData.slice(0, 3),
      selectedMetrics: selectedChartMetrics,
      enableComparison: sectionFilters.enableComparison
    });

    if (!sectionFilters.enableComparison || gscComparisonData.length === 0) {
      return [];
    }

    const allComparisonChartData: ChartDataPoint[] = [];
    
    // Filter data for cluster URLs first
    const filteredComparisonData = gscComparisonData.filter(item => 
      item.url && cluster?.urls.some(url => 
        item.url!.toLowerCase().includes(url.toLowerCase()) || 
        url.toLowerCase().includes(item.url!.toLowerCase())
      )
    );
    
    // Convert each GSC comparison data point to chart format for each selected metric
    filteredComparisonData.forEach(item => {
      selectedChartMetrics.forEach(metric => {
        if (item[metric as keyof typeof item] !== undefined && item.date) {
          allComparisonChartData.push({
            date: item.date,
            metric: metric,
            value: Number(item[metric as keyof typeof item]) || 0,
            source: 'gsc'
          });
        }
      });
    });

    console.log('📊 Comparison chart data converted:', {
      inputGSCData: gscComparisonData.length,
      outputChartData: allComparisonChartData.length,
      selectedMetrics: selectedChartMetrics,
      sampleChartData: allComparisonChartData.slice(0, 3),
      uniqueDates: [...new Set(allComparisonChartData.map(d => d.date))].length
    });

    return allComparisonChartData;
  }, [chartComparisonPeriodGSCData.data, selectedChartMetrics, cluster, sectionFilters.enableComparison]);

  // Helper function to get GSC data for a specific URL
  const getUrlGSCData = useMemo(() => {
    return (url: string) => {
      if (!urlTableGSCData.data) return [];
      return urlTableGSCData.data.filter(item => item.url === url);
    };
  }, [urlTableGSCData.data]);

  // Helper function to get GSC comparison data for a specific URL
  const getUrlGSCComparisonData = useMemo(() => {
    return (url: string) => {
      if (!urlTableComparisonGSCData.data) return [];
      return urlTableComparisonGSCData.data.filter(item => item.url === url);
    };
  }, [urlTableComparisonGSCData.data]);

  // Helper function to get Ahrefs data for a specific URL
  const getUrlAhrefsData = useMemo(() => {
    return (url: string) => {
      if (!cluster) return [];
      return clusterData.filter(item => 
        item.source === 'ahrefs' && item.url === url
      );
    };
  }, [cluster, clusterData]);

  // Prepare data for each URL tab (combines GSC and Ahrefs data for specific URL) - LEGACY for old DataTable
  const getUrlTabData = useMemo(() => {
    return (url: string) => {
      if (!cluster) return [];
      
      // Get GSC data for this URL (from the main cluster data)
      const urlGSCData = clusterData.filter(item => 
        item.source === 'gsc' && item.url === url
      );
      
      // Get Ahrefs data for this URL
      const urlAhrefsData = clusterData.filter(item => 
        item.source === 'ahrefs' && item.url === url
      );
      
      // Create a map to combine data by query
      const queryMap = new Map<string, {
        query: string;
        url: string;
        gscData?: NormalizedMetric;
        ahrefsData?: NormalizedMetric;
      }>();
      
      // Add GSC data to the map
      urlGSCData.forEach(item => {
        const key = item.query;
        if (!queryMap.has(key)) {
          queryMap.set(key, { query: key, url });
        }
        queryMap.get(key)!.gscData = item;
      });
      
      // Add Ahrefs data to the map
      urlAhrefsData.forEach(item => {
        const key = item.query;
        if (!queryMap.has(key)) {
          queryMap.set(key, { query: key, url });
        }
        queryMap.get(key)!.ahrefsData = item;
      });
      
      // Convert map to combined data format
      const combinedData = Array.from(queryMap.values()).map(({ query, url, gscData, ahrefsData }) => {
        return {
          query,
          url,
          source: 'combined' as const,
          date: gscData?.date || ahrefsData?.date || new Date().toISOString().split('T')[0],
          // GSC metrics (leave undefined if no GSC data)
          clicks: gscData?.clicks,
          impressions: gscData?.impressions,
          ctr: gscData?.ctr,
          // Ahrefs metrics (leave undefined if no Ahrefs data)
          position: ahrefsData?.position || gscData?.position, // Use GSC position as fallback
          volume: ahrefsData?.volume,
          serpFeatures: ahrefsData?.serpFeatures || gscData?.serpFeatures,
          // Additional fields
          traffic: ahrefsData?.traffic,
          kd: (ahrefsData as { kd?: number })?.kd, // Cast to proper type since kd might not be in type
        };
      });
      
      console.log(`📊 URL tab data for ${url}:`, {
        gscCount: urlGSCData.length,
        ahrefsCount: urlAhrefsData.length,
        totalCount: combinedData.length,
        sampleData: combinedData.slice(0, 3).map(item => ({
          query: item.query,
          url: item.url,
          source: item.source,
          clicks: item.clicks,
          volume: item.volume,
          serpFeatures: item.serpFeatures
        }))
      });
      
      return combinedData;
    };
  }, [cluster, clusterData]);



  // Calculate summary stats with comparison
  const summaryStats = useMemo(() => {
    const calculateStats = (data: NormalizedMetric[]) => {
    const stats = {
      totalClicks: 0,
      totalImpressions: 0,
      avgCTR: 0,
      avgPosition: 0,
      totalVolume: 0,
      };

      if (data.length === 0) {
        console.log('🔍 No data for stats calculation');
        return stats;
      }

      // Debug: Check what data we have
      const gscData = data.filter(item => item.source === 'gsc');
      const ahrefsData = data.filter(item => item.source === 'ahrefs');
      console.log('🔍 Stats calculation data:', {
        totalItems: data.length,
        gscItems: gscData.length,
        ahrefsItems: ahrefsData.length,
        gscSample: gscData.slice(0, 3).map(item => ({
          url: item.url,
          clicks: item.clicks,
          impressions: item.impressions,
          ctr: item.ctr,
          position: item.position
        })),
        ahreftsSample: ahrefsData.slice(0, 3).map(item => ({
          url: item.url,
          volume: item.volume,
          position: item.position
        }))
      });

    let positionSum = 0;
    let positionCount = 0;
    let ctrSum = 0;
    let ctrCount = 0;

      data.forEach(item => {
      stats.totalClicks += item.clicks || 0;
      stats.totalImpressions += item.impressions || 0;
      stats.totalVolume += item.volume || 0;

      if (item.position && item.position > 0) {
        positionSum += item.position;
        positionCount++;
      }

      if (item.ctr && item.ctr > 0) {
        ctrSum += item.ctr;
        ctrCount++;
      }
    });

    stats.avgPosition = positionCount > 0 ? positionSum / positionCount : 0;
      // Calculate CTR as average of all individual CTR values
    stats.avgCTR = ctrCount > 0 ? ctrSum / ctrCount : 0;

    return stats;
    };

    // Filter data by selected URLs (always apply URL filtering)
    const getFilteredData = (data: NormalizedMetric[]) => {
      return data.filter(item => selectedUrls.includes(item.url || ''));
    };

    // Calculate current stats - use date-filtered GSC data for selected URLs
    const dateFilteredGscForSelectedUrls = getFilteredData(clusterSummaryGSCData.data || []);
    const currentData = dateFilteredGscForSelectedUrls;
    
    console.log('🔍 Summary stats calculation:', {
      sectionFiltersComparison: sectionFilters.enableComparison,
      dateRange: sectionFilters.dateRange,
      clusterSummaryGscDataLength: (clusterSummaryGSCData.data || []).length,
      clusterSummaryGscClicks: (clusterSummaryGSCData.data || []).reduce((sum, item) => sum + (item.clicks || 0), 0),
      selectedUrls: selectedUrls.length,
      selectedUrlsList: selectedUrls,
      dateFilteredGscForSelectedUrlsLength: dateFilteredGscForSelectedUrls.length,
      dateFilteredGscForSelectedUrlsClicks: dateFilteredGscForSelectedUrls.reduce((sum, item) => sum + (item.clicks || 0), 0),
      currentDataLength: currentData.length,
      currentDataClicks: currentData.reduce((sum, item) => sum + (item.clicks || 0), 0),
      clusterSummaryGscSample: (clusterSummaryGSCData.data || []).slice(0, 3).map(item => ({
        url: item.url,
        clicks: item.clicks,
        impressions: item.impressions,
        source: item.source,
        selected: selectedUrls.includes(item.url || '')
      })),
      filteredSample: dateFilteredGscForSelectedUrls.slice(0, 3).map(item => ({
        url: item.url,
        clicks: item.clicks,
        impressions: item.impressions,
        source: item.source
      }))
    });
    
    const current = calculateStats(currentData);
    
    // Calculate comparison stats (if enabled) - use section filters comparison GSC data
    const previous = sectionFilters.enableComparison && clusterSummaryComparisonGSCData.data
      ? calculateStats(getFilteredData(clusterSummaryComparisonGSCData.data))
      : null;

    // Search Volume is always static from Ahrefs data, but filtered by selected URLs
    const ahrefsDataForSelectedUrls = getFilteredData(clusterData.filter(item => item.source === 'ahrefs'));
    const totalSearchVolume = ahrefsDataForSelectedUrls.reduce((sum, item) => sum + (item.volume || 0), 0);
    
    // Add search volume to current stats (and previous if needed)
    current.totalVolume = totalSearchVolume;
    if (previous) {
      previous.totalVolume = totalSearchVolume; // Same static value for both periods
    }

    console.log('🔍 Summary stats debug:', {
      sectionFiltersComparison: sectionFilters.enableComparison,
      selectedUrls: selectedUrls,
      currentDataLength: currentData.length,
      currentDataSource: 'Date-filtered GSC (filtered by selected URLs)',
      previousDataLength: previous ? (clusterSummaryComparisonGSCData.data || []).filter(item => selectedUrls.includes(item.url || '')).length : 0,
      totalSearchVolume,
      ahrefsDataForSelectedUrlsLength: ahrefsDataForSelectedUrls.length,
      current: {
        totalClicks: current.totalClicks,
        totalImpressions: current.totalImpressions,
        avgCTR: current.avgCTR,
        avgPosition: current.avgPosition
      },
      previous: previous ? {
        totalClicks: previous.totalClicks,
        totalImpressions: previous.totalImpressions,
        avgCTR: previous.avgCTR,
        avgPosition: previous.avgPosition
      } : null,
      comparisonDateRanges
    });

    // Calculate changes if comparison is enabled
    const changes = previous ? {
      clicksChange: current.totalClicks - previous.totalClicks,
      clicksChangePercent: previous.totalClicks > 0 ? ((current.totalClicks - previous.totalClicks) / previous.totalClicks) * 100 : 0,
      impressionsChange: current.totalImpressions - previous.totalImpressions,
      impressionsChangePercent: previous.totalImpressions > 0 ? ((current.totalImpressions - previous.totalImpressions) / previous.totalImpressions) * 100 : 0,
      ctrChange: current.avgCTR - previous.avgCTR,
      ctrChangePercent: previous.avgCTR > 0 ? ((current.avgCTR - previous.avgCTR) / previous.avgCTR) * 100 : 0,
      positionChange: previous.avgPosition - current.avgPosition, // Positive = improvement (lower position)
      positionChangePercent: previous.avgPosition > 0 ? ((previous.avgPosition - current.avgPosition) / previous.avgPosition) * 100 : 0,
    } : null;

    if (changes) {
      console.log('🔍 Changes calculated:', {
        clicksChange: changes.clicksChange,
        clicksChangePercent: changes.clicksChangePercent,
        impressionsChange: changes.impressionsChange,
        impressionsChangePercent: changes.impressionsChangePercent,
        ctrChange: changes.ctrChange,
        ctrChangePercent: changes.ctrChangePercent,
        positionChange: changes.positionChange,
        positionChangePercent: changes.positionChangePercent
      });
    }

    return { current, previous, changes };
  }, [
    clusterData, 
    comparisonClusterData, 
    selectedUrls, 
    sectionFilters, 
    clusterSummaryGSCData.data, 
    clusterSummaryComparisonGSCData.data
  ]);

  const handleUrlToggle = (url: string) => {
    setSelectedUrls(prev => 
      prev.includes(url) 
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  const handleSelectAll = () => {
    if (cluster) {
      setSelectedUrls(cluster.urls);
    }
  };

  const handleSelectNone = () => {
    setSelectedUrls([]);
  };

  if (!cluster) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {cluster.name}
          </DialogTitle>
          <DialogDescription>
            Performance analysis for {cluster.urls.length} URLs • {selectedUrls.length} selected
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date Range Filters for Summary Stats */}
          <SectionFilterPanel
            title="Summary Filters"
            description="Control date range and comparison for cluster summary stats"
            filters={sectionFilters}
            onFiltersChange={setSectionFilters}
            showComparisonPresets={true}
          />


          {/* URL Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">URL Selection</CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSelectNone}>
                    Select None
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {cluster.urls.map((url, index) => (
                  <div key={`${url}-${index}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`url-${url}-${index}`}
                      checked={selectedUrls.includes(url)}
                      onCheckedChange={() => handleUrlToggle(url)}
                    />
                    <label 
                      htmlFor={`url-${url}-${index}`}
                      className="text-sm truncate cursor-pointer flex-1"
                    >
                      {url}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.current.totalClicks.toLocaleString()}
                </div>
                {sectionFilters.enableComparison && summaryStats.changes && summaryStats.previous && (
                  <>
                    <div className={`text-sm flex items-center mt-1 ${
                      summaryStats.changes.clicksChangePercent > 0 ? 'text-green-600' : 
                      summaryStats.changes.clicksChangePercent < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {summaryStats.changes.clicksChangePercent > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : summaryStats.changes.clicksChangePercent < 0 ? (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 mr-1" />
                      )}
                      {summaryStats.changes.clicksChangePercent > 0 ? '+' : ''}{summaryStats.changes.clicksChangePercent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current: {summaryStats.current.totalClicks.toLocaleString()} | Previous: {summaryStats.previous.totalClicks.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Change: {summaryStats.changes.clicksChange > 0 ? '+' : ''}{summaryStats.changes.clicksChange.toLocaleString()}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.current.totalImpressions.toLocaleString()}
                </div>
                {sectionFilters.enableComparison && summaryStats.changes && summaryStats.previous && (
                  <>
                    <div className={`text-sm flex items-center mt-1 ${
                      summaryStats.changes.impressionsChangePercent > 0 ? 'text-green-600' : 
                      summaryStats.changes.impressionsChangePercent < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {summaryStats.changes.impressionsChangePercent > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : summaryStats.changes.impressionsChangePercent < 0 ? (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 mr-1" />
                      )}
                      {summaryStats.changes.impressionsChangePercent > 0 ? '+' : ''}{summaryStats.changes.impressionsChangePercent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current: {summaryStats.current.totalImpressions.toLocaleString()} | Previous: {summaryStats.previous.totalImpressions.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Change: {summaryStats.changes.impressionsChange > 0 ? '+' : ''}{summaryStats.changes.impressionsChange.toLocaleString()}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CTR (%)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.current.avgCTR > 0 ? (summaryStats.current.avgCTR * 100).toFixed(2) : 'N/A'}%
                </div>
                {sectionFilters.enableComparison && summaryStats.changes && summaryStats.previous && summaryStats.current.avgCTR > 0 && (
                  <>
                    <div className={`text-sm flex items-center mt-1 ${
                      summaryStats.changes.ctrChangePercent > 0 ? 'text-green-600' : 
                      summaryStats.changes.ctrChangePercent < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {summaryStats.changes.ctrChangePercent > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : summaryStats.changes.ctrChangePercent < 0 ? (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 mr-1" />
                      )}
                      {summaryStats.changes.ctrChangePercent > 0 ? '+' : ''}{summaryStats.changes.ctrChangePercent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current: {(summaryStats.current.avgCTR * 100).toFixed(2)}% | Previous: {summaryStats.previous.avgCTR ? (summaryStats.previous.avgCTR * 100).toFixed(2) + '%' : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Change: {summaryStats.changes.ctrChange > 0 ? '+' : ''}{(summaryStats.changes.ctrChange * 100).toFixed(2)}pp
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Position</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.current.avgPosition > 0 ? summaryStats.current.avgPosition.toFixed(1) : 'N/A'}
                </div>
                {sectionFilters.enableComparison && summaryStats.changes && summaryStats.previous && summaryStats.current.avgPosition > 0 && (
                  <>
                    <div className={`text-sm flex items-center mt-1 ${
                      summaryStats.changes.positionChangePercent > 0 ? 'text-green-600' : 
                      summaryStats.changes.positionChangePercent < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {summaryStats.changes.positionChangePercent > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : summaryStats.changes.positionChangePercent < 0 ? (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 mr-1" />
                      )}
                      {summaryStats.changes.positionChangePercent > 0 ? '+' : ''}{summaryStats.changes.positionChangePercent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current: {summaryStats.current.avgPosition.toFixed(1)} | Previous: {summaryStats.previous.avgPosition ? summaryStats.previous.avgPosition.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Change: {summaryStats.changes.positionChange > 0 ? '+' : ''}{summaryStats.changes.positionChange.toFixed(1)} positions
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                <CardTitle className="text-sm font-medium">Search Volume</CardTitle>
                  <p className="text-xs text-muted-foreground">Search Volume per month in Google</p>
                </div>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.current.totalVolume.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Static monthly data - no comparison
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Performance Chart */}
          <PerformanceChart
            data={chartData}
            comparisonData={chartComparisonData}
            selectedMetrics={selectedChartMetrics}
            onMetricsChange={setSelectedChartMetrics}
            availableMetrics={filters.metrics}
            sectionFilters={sectionFilters}
            loading={chartCurrentPeriodGSCData.loading}
            error={chartCurrentPeriodGSCData.error}
            title={`${cluster.name} - Performance Trends`}
            description={`Performance metrics for ${selectedUrls.length} selected URLs`}
          />

          {/* URL-based Tabbed Data Tables */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>{cluster.name} - Detailed Data</span>
                  </CardTitle>
                  <CardDescription>
                    Combined GSC and Ahrefs data for each URL in the cluster
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {cluster.urls.length > 0 ? (
                <Tabs value={activeUrlTab} onValueChange={setActiveUrlTab} className="w-full">
                  <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${cluster.urls.length}, 1fr)` }}>
                    {cluster.urls.map((url, index) => {
                      const urlData = getUrlTabData(url);
                      return (
                        <TabsTrigger key={`${url}-${index}`} value={url} className="flex items-center space-x-2 text-xs">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="truncate max-w-[120px]" title={url}>
                            URL {index + 1} ({urlData.length})
                          </span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  
                  {cluster.urls.map((url, index) => (
                    <TabsContent key={`${url}-${index}`} value={url} className="mt-6">
                      <div className="space-y-6">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <strong>URL:</strong> {url}
                        </div>
                        
                        {/* URL-specific Performance Chart */}
                        <PerformanceChart
                          data={(() => {
                            // Create URL-specific chart data using proper time series data
                            const urlGSCData = (chartCurrentPeriodGSCData.data || []).filter(item => item.url === url);
                            
                            console.log(`🔍 Chart data for URL ${url}:`, {
                              enableComparison,
                              chartGSCDataCount: chartCurrentPeriodGSCData.data?.length || 0,
                              gscDataCount: gscData?.length || 0,
                              urlFilteredCount: urlGSCData.length,
                              selectedMetrics: selectedChartMetrics,
                              chartGSCDataSample: (chartCurrentPeriodGSCData.data || []).slice(0, 3).map(item => ({
                                date: item.date,
                                url: item.url,
                                query: item.query,
                                clicks: item.clicks,
                                source: item.source
                              })),
                              gscDataSample: (gscData || []).slice(0, 3).map(item => ({
                                date: item.date,
                                url: item.url,
                                query: item.query,
                                clicks: item.clicks,
                                source: item.source
                              })),
                              urlSample: urlGSCData.slice(0, 2).map(item => ({
                                date: item.date,
                                url: item.url,
                                clicks: item.clicks,
                                source: item.source
                              }))
                            });
                            
                            // Aggregate GSC data by date for this URL
                            const dateAggregation = new Map<string, { clicks: number, impressions: number, position: number, positionWeightedSum: number }>();
                            
                            urlGSCData.forEach(item => {
                              const date = item.date;
                              if (!dateAggregation.has(date)) {
                                dateAggregation.set(date, { clicks: 0, impressions: 0, position: 0, positionWeightedSum: 0 });
                              }
                              const agg = dateAggregation.get(date)!;
                              agg.clicks += item.clicks || 0;
                              agg.impressions += item.impressions || 0;
                              // Weighted average for position
                              if (item.position && item.impressions) {
                                agg.positionWeightedSum += item.position * item.impressions;
                              }
                            });
                            
                            // Convert aggregated data to chart data points
                            const urlChartData: ChartDataPoint[] = [];
                            selectedChartMetrics.forEach(metric => {
                              Array.from(dateAggregation.entries()).forEach(([date, agg]) => {
                                let value: number;
                                switch (metric) {
                                  case 'clicks':
                                    value = agg.clicks;
                                    break;
                                  case 'impressions':
                                    value = agg.impressions;
                                    break;
                                  case 'ctr':
                                    value = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
                                    break;
                                  case 'position':
                                    value = agg.impressions > 0 ? agg.positionWeightedSum / agg.impressions : 0;
                                    break;
                                  default:
                                    value = 0;
                                }
                                
                                if (value !== undefined && value !== null) {
                                  urlChartData.push({
                                    date: date,
                                    value: Number(value),
                                    metric: metric,
                                    source: 'gsc'
                                  });
                                }
                              });
                            });
                            
                            console.log(`🔍 Final chart data for URL ${url}:`, {
                              chartDataCount: urlChartData.length,
                              firstFewPoints: urlChartData.slice(0, 3)
                            });
                            
                            return urlChartData;
                          })()}
                          comparisonData={(() => {
                            if (!sectionFilters.enableComparison) return [];
                            
                            // Create URL-specific comparison chart data
                            const urlComparisonGSCData = (chartComparisonPeriodGSCData.data || []).filter(item => item.url === url);
                            
                            const urlComparisonChartData: ChartDataPoint[] = [];
                            selectedChartMetrics.forEach(metric => {
                              urlComparisonGSCData.forEach(item => {
                                const value = (item as Record<string, unknown>)[metric];
                                if (value !== undefined) {
                                  urlComparisonChartData.push({
                                    date: item.date,
                                    value: Number(value),
                                    metric: metric,
                                    source: item.source
                                  });
                                }
                              });
                            });
                            
                            return urlComparisonChartData;
                          })()}
                          selectedMetrics={selectedChartMetrics}
                          onMetricsChange={setSelectedChartMetrics}
                          availableMetrics={filters.metrics}
                          sectionFilters={sectionFilters}
                          loading={chartCurrentPeriodGSCData.loading}
                          error={chartCurrentPeriodGSCData.error}
                          title={`Performance Trends - ${url.split('/').pop() || 'URL'}`}
                          description={`Performance metrics over time for this specific URL`}
                        />
                        
                        {/* URL-specific Data Table */}
                        <TabbedDataTable
                          data={getUrlAhrefsData(url)}
                          gscData={getUrlGSCData(url)}
                          gscComparisonData={getUrlGSCComparisonData(url)}
                          ahrefsCurrentPeriodData={getUrlAhrefsData(url)}
                          ahrefsComparisonData={getUrlAhrefsData(url)}
                          loading={false}
                          gscLoading={urlTableGSCData.loading}
                          gscError={urlTableGSCData.error}
                          sectionFilters={sectionFilters}
                          onSectionFiltersChange={setSectionFilters}
                          hideFilters={true}
                        />
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No URLs in this cluster
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
