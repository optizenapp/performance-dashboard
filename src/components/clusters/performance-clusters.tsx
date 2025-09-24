'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddClusterModal } from './add-cluster-modal';
import { ClusterDetailModal } from './cluster-detail-modal';
import { Plus, Globe, BarChart3, Trash2 } from 'lucide-react';
import { PerformanceCluster, NormalizedMetric, FilterOptions } from '@/lib/types';

interface PerformanceClustersProps {
  data: NormalizedMetric[];
  filters: FilterOptions;
}

export function PerformanceClusters({ data, filters }: PerformanceClustersProps) {
  const [clusters, setClusters] = useState<PerformanceCluster[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<PerformanceCluster | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Get available URLs from data
  const availableUrls = Array.from(
    new Set(
      data
        .filter(item => item.url)
        .map(item => item.url!)
        .sort()
    )
  );

  const handleCreateCluster = (clusterData: Omit<PerformanceCluster, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCluster: PerformanceCluster = {
      ...clusterData,
      id: `cluster-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setClusters([...clusters, newCluster]);
  };

  const handleDeleteCluster = (clusterId: string) => {
    setClusters(clusters.filter(c => c.id !== clusterId));
  };

  const handleViewCluster = (cluster: PerformanceCluster) => {
    setSelectedCluster(cluster);
    setShowDetailModal(true);
  };

  const getClusterStats = (cluster: PerformanceCluster) => {
    const clusterData = data.filter(item => {
      // Must be within date range
      const itemDate = new Date(item.date);
      const startDate = new Date(filters.dateRange.startDate);
      const endDate = new Date(filters.dateRange.endDate);
      if (itemDate < startDate || itemDate > endDate) return false;

      // Must be from selected sources
      if (!filters.sources.includes(item.source)) return false;

      // Must match cluster URLs
      return item.url && cluster.urls.some(url => 
        item.url!.toLowerCase().includes(url.toLowerCase()) || 
        url.toLowerCase().includes(item.url!.toLowerCase())
      );
    });

    const totalClicks = clusterData.reduce((sum, item) => sum + (item.clicks || 0), 0);
    const totalImpressions = clusterData.reduce((sum, item) => sum + (item.impressions || 0), 0);
    const totalTraffic = clusterData.reduce((sum, item) => sum + (item.traffic || 0), 0);
    const dataPoints = clusterData.length;

    return {
      totalClicks,
      totalImpressions,
      totalTraffic,
      dataPoints,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Performance Clusters
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Group URLs together to analyze their combined performance
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Cluster
        </Button>
      </div>

      {/* Clusters Grid */}
      {clusters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No clusters created yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              Create your first performance cluster to analyze groups of URLs together.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Cluster
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clusters.map((cluster) => {
            const stats = getClusterStats(cluster);
            return (
              <Card key={cluster.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      {cluster.name}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCluster(cluster.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    {cluster.urls.length} URLs • {stats.dataPoints} data points
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-semibold text-blue-600">
                          {stats.totalClicks.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">Clicks</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-green-600">
                          {stats.totalImpressions.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">Impressions</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-purple-600">
                          {stats.totalTraffic.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">Traffic</div>
                      </div>
                    </div>

                    {/* URLs Preview */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        URLs:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cluster.urls.slice(0, 3).map((url) => (
                          <Badge key={url} variant="secondary" className="text-xs">
                            {url.length > 20 ? `${url.substring(0, 20)}...` : url}
                          </Badge>
                        ))}
                        {cluster.urls.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{cluster.urls.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button 
                      className="w-full" 
                      onClick={() => handleViewCluster(cluster)}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AddClusterModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSave={handleCreateCluster}
        availableUrls={availableUrls}
      />

      <ClusterDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        cluster={selectedCluster}
        data={data}
        filters={filters}
      />
    </div>
  );
}
