'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, BarChart3, TrendingUp } from 'lucide-react';
import { NormalizedMetric, FilterOptions } from '@/lib/types';
import { getDateRangePreset } from '@/lib/data-utils';
import { SOURCES } from '@/lib/types';
import { prepareChartData, prepareTableData, extractFilterOptions, normalizeAhrefsData } from '@/lib/data-utils';
import { parseAhrefsCSV, validateCSVFile, readFileAsText } from '@/lib/csv-parser';
import { FilterPanel } from '@/components/filters/filter-panel';
import { PerformanceChart } from '@/components/charts/performance-chart';
import { DataTable } from '@/components/tables/data-table';
import { GSCConnection } from '@/components/gsc/gsc-connection';

export default function Dashboard() {
  const [data, setData] = useState<NormalizedMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('clicks');
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: getDateRangePreset('last_30_days'),
    metrics: ['clicks', 'impressions', 'ctr', 'position'],
    sources: [SOURCES.GSC, SOURCES.AHREFS],
  });


  // Mock data for development
  useEffect(() => {
    // TODO: Replace with actual API calls
    const generateMockData = (): NormalizedMetric[] => {
      const queries = [
        'seo reporting tool',
        'google search console api',
        'ahrefs keyword research',
        'search engine optimization',
        'website traffic analysis',
        'keyword ranking tracker',
        'seo dashboard',
        'organic search metrics',
      ];
      
      const urls = [
        '/seo-tools',
        '/blog/seo-guide',
        '/features/reporting',
        '/dashboard',
        '/analytics',
        '/keywords',
        '/rankings',
        '/traffic-analysis',
      ];

      const mockData: NormalizedMetric[] = [];
      const startDate = new Date('2024-01-01');
      
      // Generate 30 days of data
      for (let day = 0; day < 30; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + day);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        queries.forEach((query, queryIndex) => {
          // GSC data
          mockData.push({
            date: dateStr,
            source: SOURCES.GSC,
            query,
            url: urls[queryIndex % urls.length],
            clicks: Math.floor(Math.random() * 200) + 50,
            impressions: Math.floor(Math.random() * 3000) + 1000,
            ctr: Math.random() * 8 + 2,
            position: Math.random() * 15 + 1,
            volume: undefined,
            difficulty: undefined,
            cpc: undefined,
            traffic: undefined,
          });
          
          // Ahrefs data (not every query has Ahrefs data)
          if (Math.random() > 0.3) {
            mockData.push({
              date: dateStr,
              source: SOURCES.AHREFS,
              query,
              url: urls[queryIndex % urls.length],
              clicks: undefined,
              impressions: undefined,
              ctr: undefined,
              position: Math.random() * 20 + 1,
              volume: Math.floor(Math.random() * 2000) + 500,
              difficulty: Math.floor(Math.random() * 80) + 20,
              cpc: Math.random() * 5 + 0.5,
              traffic: Math.floor(Math.random() * 300) + 100,
            });
          }
        });
      }
      
      return mockData;
    };

    setData(generateMockData());
  }, []);

  // Calculate filtered data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Date range filter
      const itemDate = new Date(item.date);
      const startDate = new Date(filters.dateRange.startDate);
      const endDate = new Date(filters.dateRange.endDate);
      
      if (itemDate < startDate || itemDate > endDate) return false;
      
      // Query filter
      if (filters.query && !item.query?.toLowerCase().includes(filters.query.toLowerCase())) {
        return false;
      }
      
      // URL filter
      if (filters.url && !item.url?.toLowerCase().includes(filters.url.toLowerCase())) {
        return false;
      }
      
      // Source filter
      if (!filters.sources.includes(item.source)) {
        return false;
      }
      
      return true;
    });
  }, [data, filters]);

  // Calculate summary statistics from filtered data
  const summaryStats = useMemo(() => {
    const stats = {
      totalClicks: 0,
      totalImpressions: 0,
      avgCTR: 0,
      avgPosition: 0,
      totalVolume: 0,
      totalTraffic: 0,
    };

    if (filteredData.length === 0) return stats;

    let positionSum = 0;
    let positionCount = 0;
    let ctrSum = 0;
    let ctrCount = 0;

    filteredData.forEach(item => {
      stats.totalClicks += item.clicks || 0;
      stats.totalImpressions += item.impressions || 0;
      stats.totalVolume += item.volume || 0;
      stats.totalTraffic += item.traffic || 0;

      if (item.position && item.position > 0) {
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
  }, [filteredData]);

  // Derived data
  const filterOptions = extractFilterOptions(data); // Use all data for filter options
  const chartData = prepareChartData(filteredData, selectedMetric, 'date');
  const tableData = prepareTableData(filteredData);

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
        setData(prevData => {
          // Remove existing Ahrefs data and add new data
          const gscData = prevData.filter(item => item.source === SOURCES.GSC);
          return [...gscData, ...normalizedData];
        });
        
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

  const handleGSCData = (gscData: NormalizedMetric[]) => {
    // Replace existing GSC data and merge with Ahrefs data
    const ahrefsData = data.filter(item => item.source === SOURCES.AHREFS);
    setData([...gscData, ...ahrefsData]);
  };

  const downloadSampleCSV = () => {
    const sampleCSV = `keyword,url,position,volume,difficulty,cpc,traffic,date
seo reporting tool,/seo-tools,3,1200,45,2.50,180,2024-01-01
keyword research,/blog/keyword-research,7,800,35,1.80,120,2024-01-01
search console api,/api-docs,12,500,25,3.20,80,2024-01-01`;
    
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
              dateRange={filters.dateRange}
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
                    ref={(input) => {
                      if (input) {
                        (window as any).csvFileInput = input;
                      }
                    }}
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
                      {loading ? 'Processing...' : 'Upload CSV'}
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
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="font-medium">Expected columns:</div>
                    <div>keyword, url, position, volume, difficulty, cpc, traffic, date</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Date Range Controls */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Date Range
            </h2>
            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              availableQueries={filterOptions.queries}
              availableUrls={filterOptions.urls}
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalClicks.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {filteredData.length} data points
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalImpressions.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  From GSC & Ahrefs data
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. CTR</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(summaryStats.avgCTR * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Click-through rate
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Search ranking position
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Charts and Tables */}
        <div className="space-y-8">
          <PerformanceChart
            data={chartData}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            availableMetrics={filters.metrics}
            showComparison={filters.sources.length > 1}
          />

          <DataTable
            data={tableData}
            loading={loading}
          />
        </div>
      </main>
    </div>
  );
}