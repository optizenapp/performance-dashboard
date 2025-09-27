'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, CheckCircle, Trash2 } from 'lucide-react';
import { useGSC } from '@/hooks/useGSC';
import { DateRangePicker } from '@/components/filters/date-range-picker';
import { getDateRangePreset } from '@/lib/data-utils';
import { NormalizedMetric } from '@/lib/types';

interface GSCConnectionMongoProps {
  onDataFetch?: (data: NormalizedMetric[]) => void;
  initialDateRange?: { startDate: string; endDate: string };
}

export function GSCConnectionMongo({ onDataFetch, initialDateRange }: GSCConnectionMongoProps) {
  const {
    isAuthenticated,
    isLoading,
    sites,
    selectedSite,
    error,
    authenticate,
    loadSites,
    selectSite,
    disconnect,
  } = useGSC();

  const [fetchingData, setFetchingData] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importStats, setImportStats] = useState<{totalRecords: number, uniqueRecords: number, dateRange: string, importId: string} | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [clearingData, setClearingData] = useState(false);
  const [dateRange, setDateRange] = useState(() => 
    initialDateRange || getDateRangePreset('last_30_days')
  );

  // Check auth status on mount and ensure persistence
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🔐 Initializing GSC authentication...');
      
      // First, try to sync tokens if we have them in localStorage
      const tokens = localStorage.getItem('gsc_tokens');
      if (tokens) {
        try {
          await fetch('/api/gsc/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens: JSON.parse(tokens) })
          });
          console.log('✅ Tokens synced to server on mount');
          
          // Force check auth status after syncing
          const authStatus = await fetch('/api/gsc/sites');
          if (authStatus.ok) {
            console.log('✅ GSC authentication confirmed');
            await loadSites();
          } else {
            console.log('❌ GSC authentication failed, need to re-authenticate');
          }
        } catch (error) {
          console.error('Failed to sync tokens on mount:', error);
        }
      } else {
        console.log('ℹ️ No stored GSC tokens found');
      }
      
      // Load sites if already authenticated
      if (isAuthenticated) {
        await loadSites();
      }
    };
    
    initializeAuth();
  }, [isAuthenticated, loadSites]);

  const handleConnect = async () => {
    try {
      await authenticate();
    } catch (error) {
      console.error('GSC connection failed:', error);
    }
  };

  const handleFetchData = async () => {
    if (!selectedSite) return;
    
    // Create abort controller for this import
    const controller = new AbortController();
    setAbortController(controller);
    
    // Add a timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      console.log('⏰ Import timeout - forcing completion');
      controller.abort();
    }, 1200000); // 20 minutes timeout for large imports
    
    try {
      setFetchingData(true);
      setImportComplete(false);
      setImportStats(null);
      
      console.log('🚀 Starting MongoDB import...');
      
      // Call the new MongoDB import API
      const response = await fetch('/api/gsc/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }),
        signal: controller.signal
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to import data');
      }
      
      console.log('✅ MongoDB import completed:', result);
      
      // Now fetch the data from MongoDB for the frontend
      console.log('📊 Loading data from MongoDB...');
      const dataResponse = await fetch(`/api/gsc/data-mongo?siteUrl=${encodeURIComponent(selectedSite)}&limit=500000`, {
        signal: controller.signal
      });
      
      const dataResult = await dataResponse.json();
      
      if (!dataResponse.ok) {
        throw new Error(dataResult.error || 'Failed to load data from MongoDB');
      }
      
      console.log('📊 Data loaded from MongoDB:', {
        recordCount: dataResult.data.length,
        pagination: dataResult.pagination
      });
      
      // Pass data to parent component
      if (onDataFetch) {
        console.log('🔄 Calling onDataFetch callback...');
        try {
          onDataFetch(dataResult.data);
          console.log('✅ onDataFetch callback completed');
        } catch (error) {
          console.error('❌ onDataFetch callback failed:', error);
        }
      }
      
      // Calculate import statistics
      const dates = dataResult.data.map((item: any) => item.date).sort();
      const earliestDate = dates[0];
      const latestDate = dates[dates.length - 1];
      
      // Set completion state immediately
      console.log('🎯 Setting completion state NOW');
      setFetchingData(false);
      
      setImportStats({
        totalRecords: result.recordCount,
        uniqueRecords: dataResult.data.length,
        dateRange: `${earliestDate} to ${latestDate}`,
        importId: result.importId
      });
      setImportComplete(true);
      
      console.log('🎉 GSC data import completed successfully!', {
        importId: result.importId,
        totalRecords: result.recordCount,
        uniqueRecords: dataResult.data.length,
        dateRange: `${earliestDate} to ${latestDate}`
      });
      
      // Auto-hide completion message after 10 seconds
      setTimeout(() => {
        setImportComplete(false);
        setImportStats(null);
      }, 10000);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 Import was cancelled by user');
      } else {
        console.error('Failed to import GSC data:', error);
      }
      setFetchingData(false);
    } finally {
      clearTimeout(timeoutId);
      setAbortController(null);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm('⚠️ Are you sure you want to clear all data from the database?\n\nThis will delete:\n• All GSC data\n• All Ahrefs data\n• All import history\n\nThis action cannot be undone!')) {
      return;
    }

    setClearingData(true);
    
    try {
      console.log('🗑️ Clearing database...');
      
      const response = await fetch('/api/data/clear?source=all', {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to clear database');
      }

      console.log('✅ Database cleared:', result);

      // Clear the frontend data as well
      if (onDataFetch) {
        onDataFetch([]);
      }

      // Reset completion state
      setImportComplete(false);
      setImportStats(null);

      alert(`✅ Database cleared successfully!\n\n${result.dataRecordsDeleted.toLocaleString()} data records deleted\n${result.importRecordsDeleted} import records deleted\n\nYou can now import fresh data.`);

    } catch (error) {
      console.error('Failed to clear database:', error);
      alert(`❌ Failed to clear database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setClearingData(false);
    }
  };

  const formatSiteUrl = (url: string) => {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Google Search Console (MongoDB)
          </CardTitle>
          <CardDescription>
            Connect to import GSC data directly to MongoDB for better performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnect} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect to GSC'
            )}
          </Button>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Google Search Console (MongoDB)
          <Badge variant="secondary">Connected</Badge>
        </CardTitle>
        <CardDescription>
          Import GSC data to MongoDB for fast, persistent storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Site Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Select Site:</label>
          <select
            value={selectedSite || ''}
            onChange={(e) => selectSite(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={isLoading || fetchingData}
          >
            <option value="">Select a site...</option>
            {sites.map((site) => (
              <option key={site} value={site}>
                {formatSiteUrl(site)}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="text-sm font-medium mb-2 block">Date Range:</label>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        {/* Import Actions */}
        <div className="flex space-x-2">
          {fetchingData ? (
            <Button
              onClick={() => {
                // Cancel ongoing requests
                if (abortController) {
                  abortController.abort();
                }
                setFetchingData(false);
                setImportComplete(false);
                setImportStats(null);
                setAbortController(null);
                console.log('🛑 Import manually stopped by user');
              }}
              variant="destructive"
              className="flex-1"
            >
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Stop Import
            </Button>
          ) : importComplete ? (
            <Button
              onClick={() => {
                setImportComplete(false);
                setImportStats(null);
              }}
              variant="default"
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Import Complete - Click to Dismiss
            </Button>
          ) : (
            <Button
              onClick={handleFetchData}
              disabled={!selectedSite || isLoading}
              className="flex-1"
            >
              <Database className="h-4 w-4 mr-2" />
              Import to MongoDB
            </Button>
          )}
          
              <Button
                variant="outline"
                onClick={disconnect}
                disabled={isLoading || fetchingData}
              >
                Disconnect
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearDatabase}
                disabled={isLoading || fetchingData || clearingData}
                className="ml-2"
              >
                {clearingData ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear DB
                  </>
                )}
              </Button>
        </div>

        {/* Completion Stats */}
        {importComplete && importStats && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center mb-2">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Import Completed Successfully!
                </h3>
              </div>
            </div>
            <div className="mt-2 text-sm text-green-700">
              <div className="grid grid-cols-1 gap-1">
                <div><strong>Import ID:</strong> {importStats.importId}</div>
                <div><strong>Total Records:</strong> {importStats.totalRecords.toLocaleString()}</div>
                <div><strong>Loaded Records:</strong> {importStats.uniqueRecords.toLocaleString()}</div>
                <div><strong>Date Range:</strong> {importStats.dateRange}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-green-600">
              Data is now stored in MongoDB and ready for analysis. This message will auto-hide in 10 seconds.
            </div>
          </div>
        )}

        {selectedSite && (
          <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <strong>Selected:</strong> {formatSiteUrl(selectedSite)}
            <br />
            <strong>Date Range:</strong> {dateRange.startDate} to {dateRange.endDate}
            <br />
            <strong>Storage:</strong> MongoDB (persistent, fast retrieval)
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
