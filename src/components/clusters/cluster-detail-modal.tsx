'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PerformanceChart } from '@/components/charts/performance-chart';
import { DataTable } from '@/components/tables/data-table';
import { BarChart3, TrendingUp, Globe } from 'lucide-react';
import { PerformanceCluster, NormalizedMetric, FilterOptions } from '@/lib/types';
import { prepareChartData, prepareTableData } from '@/lib/data-utils';

interface ClusterDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: PerformanceCluster | null;
  data: NormalizedMetric[];
  filters: FilterOptions;
}

export function ClusterDetailModal({ 
  open, 
  onOpenChange, 
  cluster, 
  data,
  filters
}: ClusterDetailModalProps) {
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [selectedChartMetrics, setSelectedChartMetrics] = useState<string[]>(['clicks']);

  // Initialize selected URLs when cluster changes
  useMemo(() => {
    if (cluster) {
      setSelectedUrls(cluster.urls);
    }
  }, [cluster]);

  // Filter data for the cluster URLs and selected URLs
  const clusterData = useMemo(() => {
    if (!cluster) return [];
    
    return data.filter(item => {
      // Must be within date range
      const itemDate = new Date(item.date);
      const startDate = new Date(filters.dateRange.startDate);
      const endDate = new Date(filters.dateRange.endDate);
      if (itemDate < startDate || itemDate > endDate) return false;

      // Must be from selected sources
      if (!filters.sources.includes(item.source)) return false;

      // Must match selected URLs
      return item.url && selectedUrls.some(url => 
        item.url!.toLowerCase().includes(url.toLowerCase()) || 
        url.toLowerCase().includes(item.url!.toLowerCase())
      );
    });
  }, [cluster, data, filters, selectedUrls]);

  // Prepare chart data for multiple metrics
  const chartData = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allChartData: any[] = [];
    selectedChartMetrics.forEach(metric => {
      const metricData = prepareChartData(clusterData, metric, 'date');
      allChartData.push(...metricData);
    });
    return allChartData;
  }, [clusterData, selectedChartMetrics]);

  const tableData = useMemo(() => {
    return prepareTableData(clusterData);
  }, [clusterData]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const stats = {
      totalClicks: 0,
      totalImpressions: 0,
      avgCTR: 0,
      avgPosition: 0,
      totalVolume: 0,
      totalTraffic: 0,
    };

    if (clusterData.length === 0) return stats;

    let positionSum = 0;
    let positionCount = 0;
    let ctrSum = 0;
    let ctrCount = 0;

    clusterData.forEach(item => {
      stats.totalClicks += item.clicks || 0;
      stats.totalImpressions += item.impressions || 0;
      stats.totalVolume += item.volume || 0;
      stats.totalTraffic += item.traffic || 0;

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
    stats.avgCTR = ctrCount > 0 ? ctrSum / ctrCount : 0;

    return stats;
  }, [clusterData]);

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
                {cluster.urls.map((url) => (
                  <div key={url} className="flex items-center space-x-2">
                    <Checkbox
                      id={`url-${url}`}
                      checked={selectedUrls.includes(url)}
                      onCheckedChange={() => handleUrlToggle(url)}
                    />
                    <label 
                      htmlFor={`url-${url}`}
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
                  {summaryStats.totalClicks.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalImpressions.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CTR (%)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.avgCTR > 0 ? (summaryStats.avgCTR * 100).toFixed(2) : 'N/A'}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Position</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.avgPosition > 0 ? summaryStats.avgPosition.toFixed(1) : 'N/A'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Search Volume</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalVolume.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Traffic</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalTraffic.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <PerformanceChart
            data={chartData}
            selectedMetrics={selectedChartMetrics}
            onMetricsChange={setSelectedChartMetrics}
            availableMetrics={filters.metrics}
            title={`${cluster.name} - Performance Trends`}
            description={`Performance metrics for ${selectedUrls.length} selected URLs`}
          />

          {/* Data Table */}
          <DataTable
            data={tableData}
            title={`${cluster.name} - Detailed Data`}
            description={`Detailed performance data for selected URLs`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
