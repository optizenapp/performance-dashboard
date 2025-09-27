'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useGSC } from '@/contexts/GSCContext';

export function GSCConnection() {
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

  // Date range is no longer needed since we fetch on-demand based on Quick View filters
  // Removed import-related state since we now use on-demand fetching

  // Check auth status on mount and sync tokens
  useEffect(() => {
    const initializeAuth = async () => {
      // First, try to sync tokens if we have them in localStorage
      const tokens = localStorage.getItem('gsc_tokens');
      if (tokens) {
        try {
          await fetch('/api/gsc/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens: JSON.parse(tokens) })
          });
          console.log('Tokens synced to server on mount');
        } catch (error) {
          console.error('Failed to sync tokens on mount:', error);
        }
      }
      
      // Then check auth status
      await checkAuthStatus();
    };
    
    initializeAuth();
  }, [checkAuthStatus]);

  const handleConnect = async () => {
    try {
      await authenticate();
    } catch (error) {
      console.error('GSC connection failed:', error);
    }
  };

  const formatSiteUrl = (url: string) => {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="h-5 w-5" />
          <span>Google Search Console</span>
          {isAuthenticated && !selectedSite && <Badge variant="secondary">Connected</Badge>}
          {selectedSite && <Badge variant="default">{formatSiteUrl(selectedSite)}</Badge>}
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

            {/* Date ranges are now managed in the Quick View section */}

            {/* Connection Status */}
            <div className="flex space-x-2 items-center">
              {selectedSite ? (
                <div className="flex-1 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-green-900 dark:text-green-100">
                        Connected to: {formatSiteUrl(selectedSite)}
                      </span>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Quick View will automatically fetch fresh data for this site
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      Select a site above to start
                    </span>
                  </div>
                </div>
              )}
              
              <Button
                variant="outline"
                onClick={disconnect}
                disabled={isLoading}
              >
                Disconnect
              </Button>
            </div>
            
            {/* Progress indicator removed - no longer needed with on-demand fetching */}

            {/* Completion indicator removed - no longer needed with on-demand fetching */}
            {false && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-lg">✅</span>
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
                    <div><strong>Total Records:</strong> {importStats.totalRecords.toLocaleString()}</div>
                    <div><strong>Unique Records:</strong> {importStats.uniqueRecords.toLocaleString()}</div>
                    <div><strong>Date Range:</strong> {importStats.dateRange}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-green-600">
                  This message will auto-hide in 10 seconds, or click the button above to dismiss.
                </div>
              </div>
            )}

            {/* Debug info removed - date ranges now managed in Quick View section */}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
