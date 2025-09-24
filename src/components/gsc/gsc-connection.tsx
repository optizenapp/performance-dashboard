'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, CheckCircle, AlertCircle, Loader2, ExternalLink, Calendar } from 'lucide-react';
import { DateRangePicker } from '@/components/filters/date-range-picker';
import { getDateRangePreset } from '@/lib/data-utils';
import { useGSC } from '@/hooks/useGSC';
import { NormalizedMetric } from '@/lib/types';

interface GSCConnectionProps {
  onDataFetch?: (data: NormalizedMetric[]) => void;
  dateRange?: { startDate: string; endDate: string };
}

export function GSCConnection({ onDataFetch, dateRange: initialDateRange }: GSCConnectionProps) {
  const {
    isAuthenticated,
    isLoading,
    sites,
    selectedSite,
    error,
    authenticate,
    checkAuthStatus,
    fetchData,
    selectSite,
    disconnect,
  } = useGSC();

  const [fetchingData, setFetchingData] = useState(false);
  const [dateRange, setDateRange] = useState(() => 
    initialDateRange || getDateRangePreset('last_30_days')
  );

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleConnect = async () => {
    try {
      await authenticate();
    } catch (error) {
      console.error('GSC connection failed:', error);
    }
  };

  const handleFetchData = async () => {
    if (!selectedSite) return;
    
    try {
      setFetchingData(true);
      
      // Fetch aggregated data for table (query-level data)
      // Time series data is mainly for charts and contains "Total" entries that we don't want in tables
      const aggregatedData = await fetchData(dateRange.startDate, dateRange.endDate, ['query', 'page'], false);
      
      if (onDataFetch) {
        onDataFetch(aggregatedData);
      }
    } catch (error) {
      console.error('Failed to fetch GSC data:', error);
    } finally {
      setFetchingData(false);
    }
  };

  const formatSiteUrl = (url: string) => {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="h-5 w-5 text-blue-600" />
          <span>Google Search Console</span>
          {isAuthenticated && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Connect your GSC account to import real-time search performance data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isAuthenticated ? (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="mb-2">To connect Google Search Console, you&apos;ll need to:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Authorize access to your GSC account</li>
                <li>Select which property to analyze</li>
                <li>Import your search performance data</li>
              </ol>
            </div>
            
            <Button 
              onClick={handleConnect} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opening authentication popup...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect to Google Search Console
                </>
              )}
            </Button>
            
            {isLoading && (
              <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                📱 A popup window will open for Google authentication. Please allow popups for this site if blocked.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Site Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Property:</label>
              <Select value={selectedSite || ''} onValueChange={selectSite} disabled={isLoading || sites.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    isLoading ? "Loading properties..." : 
                    sites.length === 0 ? "No properties found" : 
                    "Choose a property"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site} value={site}>
                      {formatSiteUrl(site)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sites.length === 0 && !isLoading && (
                <p className="text-sm text-gray-500">
                  No Search Console properties found. Make sure you have access to at least one verified property.
                </p>
              )}
            </div>

            {/* Date Range Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Import Date Range:</span>
              </label>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>

            {/* Data Import */}
            <div className="flex space-x-2">
              <Button
                onClick={handleFetchData}
                disabled={!selectedSite || fetchingData || isLoading}
                className="flex-1"
              >
                {fetchingData ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing Data...
                  </>
                ) : (
                  'Import GSC Data'
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={disconnect}
                disabled={isLoading || fetchingData}
              >
                Disconnect
              </Button>
            </div>

            {selectedSite && (
              <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <strong>Selected:</strong> {formatSiteUrl(selectedSite)}
                <br />
                <strong>Date Range:</strong> {dateRange.startDate} to {dateRange.endDate}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
