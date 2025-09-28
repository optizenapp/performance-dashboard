'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import { NormalizedMetric, SectionFilters } from '@/lib/types';
import { SectionFilterPanel } from '@/components/filters/section-filter-panel';
import { GSCDataTable } from './gsc-data-table';
import { GSCComparisonTable } from './gsc-comparison-table';
import { AhrefsDataTable } from './ahrefs-data-table';
import { AhrefsComparisonTable } from './ahrefs-comparison-table';

interface TabbedDataTableProps {
  data: NormalizedMetric[]; // All Ahrefs data (for non-comparison table)
  gscData?: any[]; // NEW: GSC data from API
  gscComparisonData?: any[]; // NEW: GSC comparison data from API
  ahrefsCurrentPeriodData?: NormalizedMetric[]; // NEW: Filtered current period Ahrefs data
  ahrefsComparisonData?: NormalizedMetric[]; // NEW: Ahrefs comparison data
  fullData?: NormalizedMetric[]; // Full dataset for comparison tables (legacy)
  loading?: boolean;
  gscLoading?: boolean; // NEW: GSC loading state
  gscError?: string | null; // NEW: GSC error state
  sectionFilters: SectionFilters;
  onSectionFiltersChange: (filters: SectionFilters) => void;
  hideFilters?: boolean; // NEW: Hide the internal filter panel (for cluster modal)
}

export function TabbedDataTable({
  data,
  gscData,
  gscComparisonData,
  ahrefsCurrentPeriodData,
  ahrefsComparisonData,
  fullData,
  loading = false,
  gscLoading = false,
  gscError = null,
  sectionFilters,
  onSectionFiltersChange,
  hideFilters = false,
}: TabbedDataTableProps) {
  const [activeTab, setActiveTab] = useState('gsc');

  console.log('📊 TabbedDataTable received:', {
    legacyDataCount: data.length,
    gscDataCount: gscData?.length || 0,
    gscComparisonDataCount: gscComparisonData?.length || 0,
    sectionFilters,
    dateRange: sectionFilters.dateRange,
    hasValidDateRange: sectionFilters.dateRange.startDate && sectionFilters.dateRange.endDate,
    gscLoading,
    // Debug: Check current period Ahrefs data dates
    currentAhrefsData: {
      count: data.filter(item => item.source === 'ahrefs').length,
      uniqueDates: [...new Set(data.filter(item => item.source === 'ahrefs').map(item => item.date))].sort(),
      sampleDates: data.filter(item => item.source === 'ahrefs').slice(0, 5).map(item => item.date)
    },
    gscError
  });

  // Filter legacy data by source (for Ahrefs)
  const ahrefsData = data.filter(item => item.source === 'ahrefs');
  
  // GSC data count for display (use new GSC data if available, fallback to legacy)
  const gscDataCount = gscData?.length || data.filter(item => item.source === 'gsc').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Performance Data</span>
            </CardTitle>
            <CardDescription>
              Detailed metrics for your queries and keywords with independent filtering
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Table-specific filters - only show if not hidden AND Ahrefs tab is active */}
        {!hideFilters && activeTab === 'ahrefs' && (
          <>
            <SectionFilterPanel
              title="Ahrefs Table Filters"
              description="Control date range and comparison for Ahrefs table"
              icon={<BarChart3 className="h-4 w-4 text-orange-500" />}
              filters={sectionFilters}
              onFiltersChange={onSectionFiltersChange}
              className="border border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-900/20"
              activeTab={activeTab} // Pass active tab for Ahrefs-specific filters
            />
            
            {/* Table date range display */}
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Table showing data for:</span>
              <span>
                {new Date(sectionFilters.dateRange.startDate).toISOString().split('T')[0]} - {new Date(sectionFilters.dateRange.endDate).toISOString().split('T')[0]}
              </span>
            </div>
          </>
        )}
        
        {/* Tabbed Tables */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gsc" className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Google Search Console ({gscDataCount.toLocaleString()})</span>
            </TabsTrigger>
            <TabsTrigger value="ahrefs" className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span>Ahrefs ({ahrefsData.length.toLocaleString()})</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="gsc" className="mt-6">
            {sectionFilters.enableComparison ? (
              <GSCComparisonTable
                data={gscData || []}
                comparisonData={gscComparisonData || []}
                loading={gscLoading}
                error={gscError}
                sectionFilters={sectionFilters}
              />
            ) : (
              <GSCDataTable
                data={gscData || []}
                loading={gscLoading}
                error={gscError}
                sectionFilters={sectionFilters}
              />
            )}
          </TabsContent>
          
          <TabsContent value="ahrefs" className="mt-6">
            {sectionFilters.enableComparison ? (
              <AhrefsComparisonTable
                data={ahrefsCurrentPeriodData || []}
                comparisonData={ahrefsComparisonData || []}
                loading={loading}
                sectionFilters={sectionFilters}
              />
            ) : (
              <AhrefsDataTable
                data={ahrefsData}
                loading={loading}
                sectionFilters={sectionFilters}
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
