import { google } from 'googleapis';
import { GSCMetric } from './types';

// Google Search Console API client
export class GSCClient {
  private auth: InstanceType<typeof google.auth.OAuth2>;
  private searchconsole: ReturnType<typeof google.searchconsole>;

  constructor() {
    // Initialize OAuth2 client
    const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 
      (typeof window !== 'undefined' 
        ? `${window.location.origin}/api/auth/callback`
        : `http://localhost:${process.env.PORT || 3000}/api/auth/callback`
      );
    
    console.log('GSC Client initialized with redirect URI:', redirectUri);
    
    this.auth = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    this.searchconsole = google.searchconsole({ version: 'v1', auth: this.auth });
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/webmasters.readonly'];
    
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  /**
   * Set access token from OAuth callback
   */
  async setCredentials(code: string): Promise<void> {
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    
    console.log('GSC Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      tokenType: tokens.token_type
    });
    
    // Store tokens in localStorage for persistence (client-side only)
    if (typeof window !== 'undefined') {
      localStorage.setItem('gsc_tokens', JSON.stringify(tokens));
      console.log('Tokens stored in localStorage');
    }
    
    // Always store in global cache for server-side access
    // In production, you'd want to use a proper database or session storage
    global.gscTokens = tokens;
    console.log('Tokens stored in global cache');
  }

  /**
   * Load stored credentials from localStorage or server cache
   */
  loadStoredCredentials(): boolean {
    console.log('Loading stored credentials...', {
      isClient: typeof window !== 'undefined',
      hasGlobalTokens: !!global.gscTokens,
      hasLocalStorage: typeof window !== 'undefined' && !!localStorage.getItem('gsc_tokens')
    });
    
    // Client-side: use localStorage and sync to global cache
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gsc_tokens');
      if (stored) {
        try {
          const tokens = JSON.parse(stored);
          this.auth.setCredentials(tokens);
          // Also store in global cache for server-side access
          global.gscTokens = tokens;
          console.log('Credentials loaded from localStorage and synced to global cache');
          return true;
        } catch (error) {
          console.error('Failed to load stored credentials:', error);
          localStorage.removeItem('gsc_tokens');
        }
      }
      return false;
    }
    
    // Server-side: use global cache
    if (global.gscTokens) {
      this.auth.setCredentials(global.gscTokens);
      console.log('Credentials loaded from global cache');
      return true;
    }
    
    console.log('No stored credentials found');
    return false;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.auth.credentials && this.auth.credentials.access_token);
  }

  /**
   * Get list of verified sites
   */
  async getSites(): Promise<string[]> {
    try {
      const response = await this.searchconsole.sites.list();
      return response.data.siteEntry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.filter((site: any) => site.permissionLevel === 'siteOwner' || site.permissionLevel === 'siteFullUser')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((site: any) => site.siteUrl) || [];
    } catch (error) {
      console.error('Failed to get sites:', error);
      throw new Error('Failed to retrieve sites from Google Search Console');
    }
  }

  /**
   * Query Search Console data
   */
  async querySearchConsole(
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions: string[] = ['query'],
    rowLimit: number = 25000,
    includeUnfinalizedData: boolean = true
  ): Promise<GSCMetric[]> {
    try {
      // Smart row limiting: Reduce limits for query breakdowns to get fast results
      let optimizedRowLimit = rowLimit;
      if (dimensions.includes('query')) {
        // For query breakdowns, use smaller limits to get top performers quickly
        const dateRange = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
        if (dateRange > 30) {
          optimizedRowLimit = Math.min(rowLimit, 2000); // Top 2K queries for long ranges
        } else if (dateRange > 7) {
          optimizedRowLimit = Math.min(rowLimit, 5000); // Top 5K queries for medium ranges
        }
        
        console.log('🎯 Smart Row Limiting for Query Breakdown:', {
          originalLimit: rowLimit,
          optimizedLimit: optimizedRowLimit,
          dateRangeDays: dateRange,
          strategy: optimizedRowLimit < rowLimit ? 'LIMITED for speed' : 'FULL'
        });
      }
      
      const request = {
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions,
          rowLimit: optimizedRowLimit,
          startRow: 0,
          dataState: includeUnfinalizedData ? 'all' : 'final',
        },
      };

      console.log('GSC API Request:', {
        siteUrl,
        startDate,
        endDate,
        dimensions,
        rowLimit,
        dataState: includeUnfinalizedData ? 'all' : 'final',
        dateRangeInfo: {
          startDateParsed: new Date(startDate).toISOString(),
          endDateParsed: new Date(endDate).toISOString(),
          isStartFuture: new Date(startDate) > new Date(),
          isEndFuture: new Date(endDate) > new Date(),
          daysSinceStart: Math.floor((new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)),
          daysSinceEnd: Math.floor((new Date().getTime() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24))
        }
      });

      const response = await this.searchconsole.searchanalytics.query(request);
      const data = response.data;

      console.log('GSC API Response:', {
        siteUrl,
        responseReceived: !!response,
        dataReceived: !!data,
        rowCount: data?.rows?.length || 0,
        requestedLimit: rowLimit,
        hitLimit: (data?.rows?.length || 0) >= rowLimit,
        firstRow: data?.rows?.[0],
        responseStatus: response.status,
        dataAvailability: {
          receivedRows: data?.rows?.length || 0,
          maxPossible: rowLimit,
          percentageOfLimit: Math.round(((data?.rows?.length || 0) / rowLimit) * 100)
        },
        dataState: includeUnfinalizedData ? 'all' : 'final',
        needsPagination: (data?.rows?.length || 0) >= rowLimit
      });

      // Check if we hit the row limit and warn about potential incomplete data
      if (data.rows && data.rows.length >= rowLimit) {
        console.warn('⚠️ GSC API Row Limit Reached:', {
          receivedRows: data.rows.length,
          requestedLimit: rowLimit,
          message: 'Data may be incomplete. Consider using pagination or reducing date range.',
          dimensions,
          dateRange: `${startDate} to ${endDate}`,
          impact: 'Some data is missing due to API limits'
        });
        
        // Also log to help debug the 32k vs 43k discrepancy
        console.error('🚨 DATA LOSS DETECTED:', {
          siteUrl,
          dateRange: `${startDate} to ${endDate}`,
          rowsReturned: data.rows.length,
          rowsLost: 'Unknown (could be thousands)',
          solution: 'Need to implement pagination or smaller chunks'
        });
      }
      
      // Also warn if we hit common row limits even below the requested limit
      if (data.rows && (data.rows.length === 5000 || data.rows.length === 10000)) {
        console.warn('⚠️ Suspected GSC Row Limit Hit:', {
          receivedRows: data.rows.length,
          likelyLimit: data.rows.length,
          dateRange: `${startDate} to ${endDate}`,
          message: `Received exactly ${data.rows.length} rows - likely hitting a GSC internal limit`,
          recommendation: 'Consider smaller date ranges or different dimensions'
        });
      }

      if (!data.rows || data.rows.length === 0) {
        const now = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        
        console.warn('GSC returned no data. Possible reasons:', {
          siteUrl,
          dateRange: `${startDate} to ${endDate}`,
          dimensions,
          possibleIssues: [
            start > threeDaysAgo ? 'Date range too recent (GSC has 2-3 day delay)' : null,
            start > now ? 'Start date is in the future' : null,
            end > now ? 'End date is in the future' : null,
            'No data available for this site in the date range',
            'Site URL format incorrect',
            'User lacks permission for this property'
          ].filter(Boolean),
          recommendations: {
            suggestedEndDate: threeDaysAgo.toISOString().split('T')[0],
            suggestedStartDate: new Date(threeDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        });
        return [];
      }

      // Transform GSC response to our format
      return data.rows.map((row, index) => {
        const keys = row.keys || [];
        
        // For aggregated queries, GSC doesn't return individual dates. Since this is aggregated data
        // representing the entire date range, we'll use the end date to ensure it appears in filters.
        // This represents "data through this end date" which is more accurate for aggregated metrics.
        
        // Log the date assignment and dimension extraction for the first few rows
        if (data.rows && index < 3) {
          console.log(`🔍 GSC Row ${index} Processing:`, {
            originalRange: `${startDate} to ${endDate}`,
            assignedDate: endDate,
            dimensions,
            keys,
            keysLength: keys.length,
            queryIndex: dimensions.indexOf('query'),
            pageIndex: dimensions.indexOf('page'),
            extractedQuery: dimensions.includes('query') ? keys[dimensions.indexOf('query')] : undefined,
            extractedPage: dimensions.includes('page') ? keys[dimensions.indexOf('page')] : undefined
          });
        }
        
        return {
          date: endDate, // Use end date for aggregated data representing the full period
          query: dimensions.includes('query') ? keys[dimensions.indexOf('query')] : undefined,
          page: dimensions.includes('page') ? keys[dimensions.indexOf('page')] : undefined,
          country: dimensions.includes('country') ? keys[dimensions.indexOf('country')] : undefined,
          device: dimensions.includes('device') ? keys[dimensions.indexOf('device')] : undefined,
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        };
      });
    } catch (error) {
      console.error('GSC API Error:', error);
      throw new Error('Failed to query Google Search Console API');
    }
  }

  /**
   * Get performance data for date range with automatic chunking to avoid row limits
   */
  async getPerformanceData(
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions: string[] = ['query', 'page']
  ): Promise<GSCMetric[]> {
    // If requesting daily data (includes 'date' dimension), use chunking to avoid row limits
    if (dimensions.includes('date')) {
      return await this.getPerformanceDataWithChunking(siteUrl, startDate, endDate, dimensions);
    }
    
    // 🚀 NEW: For query data, use single request with 1000 row limit (matches GSC console)
    if (dimensions.includes('query') || dimensions.includes('page')) {
      console.log('🚀 GSC Strategy: Top 1000 queries (matches GSC console behavior)', {
        dimensions,
        rowLimit: 1000,
        reason: 'GSC console only shows top 1000 rows - match that behavior'
      });
      return await this.querySearchConsole(siteUrl, startDate, endDate, dimensions, 1000);
    }
    
    // For aggregated data without query dimensions, use standard request
    return await this.querySearchConsole(siteUrl, startDate, endDate, dimensions);
  }

  /**
   * Get the maximum allowed start date (16 months ago) per GSC limits
   */
  private getMaxAllowedStartDate(): string {
    const today = new Date();
    const sixteenMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 16, today.getDate());
    return sixteenMonthsAgo.toISOString().split('T')[0];
  }

  /**
   * Validate date range against GSC limits
   */
  private validateDateRange(startDate: string, endDate: string): { valid: boolean; error?: string; adjustedStartDate?: string } {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const maxStartDate = new Date(this.getMaxAllowedStartDate());
    
    // Check if end date is in the future
    if (end > today) {
      return { 
        valid: false, 
        error: `End date cannot be in the future. Maximum end date: ${today.toISOString().split('T')[0]}` 
      };
    }
    
    // Check if start date is too far back
    if (start < maxStartDate) {
      const adjustedStart = this.getMaxAllowedStartDate();
      console.warn('⚠️ GSC Date Range Adjustment:', {
        requestedStart: startDate,
        adjustedStart,
        reason: 'GSC only provides 16 months of historical data',
        maxAllowedStart: adjustedStart
      });
      
      return { 
        valid: true, 
        adjustedStartDate: adjustedStart,
        error: `Start date adjusted from ${startDate} to ${adjustedStart} (GSC 16-month limit)`
      };
    }
    
    // Check if date range is valid
    if (start >= end) {
      return { 
        valid: false, 
        error: 'Start date must be before end date' 
      };
    }
    
    return { valid: true };
  }

  /**
   * Get performance data with date chunking to handle large datasets
   */
  private async getPerformanceDataWithChunking(
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions: string[]
  ): Promise<GSCMetric[]> {
    // Validate and potentially adjust date range
    const validation = this.validateDateRange(startDate, endDate);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Use adjusted start date if provided
    const actualStartDate = validation.adjustedStartDate || startDate;
    
    const start = new Date(actualStartDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // For aggregated data (no dimensions), always use single request - it's fast!
    if (dimensions.length === 0) {
      console.log('🚀 GSC Strategy: FAST aggregated totals (no dimensions) for', totalDays, 'days - single API call');
      return await this.querySearchConsole(siteUrl, actualStartDate, endDate, dimensions, 25000);
    }
    
    // For query breakdowns, use smart row limiting to avoid long waits
    if (dimensions.includes('query')) {
      console.log('🎯 GSC Strategy: Query breakdown detected - using smart row limiting');
      // Use smaller chunks and row limits for query data to get top performers quickly
    }
    
    // For high-traffic sites with dimensions, always use chunking even for small ranges
    // This prevents hitting the 5K row limit that many sites encounter
    if (totalDays <= 7) {
      console.log('🔄 GSC Strategy: Small range but using 1-day chunks to avoid 5K row limits');
      // Continue to chunking logic below
    }

    // Optimize chunk size based on total days to balance API calls vs row limits
    // REDUCED chunk sizes to avoid hitting 25K row limits for high-traffic sites
    let chunkSizeDays: number;
    if (totalDays <= 30) {
      chunkSizeDays = 1; // 1-day chunks for small ranges (was 3)
    } else if (totalDays <= 90) {
      chunkSizeDays = 2; // 2-day chunks for 1-3 months (was 7)  
    } else if (totalDays <= 180) {
      chunkSizeDays = 3; // 3-day chunks for 3-6 months (was 10)
    } else {
      chunkSizeDays = 5; // 5-day chunks for 6+ months (was 14)
    }
    
    console.log('🔄 GSC Chunking Strategy:', {
      totalDays,
      totalMonths: Math.round(totalDays / 30.44), // Average days per month
      requestedStartDate: startDate,
      actualStartDate,
      endDate,
      dateRangeAdjusted: actualStartDate !== startDate,
      dimensions,
      chunkSizeDays,
      estimatedChunks: Math.ceil(totalDays / chunkSizeDays),
      strategy: totalDays <= 30 ? '1-day chunks (high precision)' :
                totalDays <= 90 ? '2-day chunks (medium precision)' :
                totalDays <= 180 ? '3-day chunks (balanced)' :
                '5-day chunks (16-month max)',
      gscDataLimit: '16 months maximum per GSC API limits',
      maxAllowedStartDate: this.getMaxAllowedStartDate()
    });

    // For larger ranges, chunk strategically to stay under row limit
    const allData: GSCMetric[] = [];
    
    let currentStart = new Date(start);
    let chunkCount = 0;
    
    while (currentStart <= end) {
      const currentEnd = new Date(Math.min(
        currentStart.getTime() + (chunkSizeDays - 1) * 24 * 60 * 60 * 1000,
        end.getTime()
      ));
      
      const chunkStartStr = currentStart.toISOString().split('T')[0];
      const chunkEndStr = currentEnd.toISOString().split('T')[0];
      
      console.log(`📊 Fetching GSC chunk ${++chunkCount}:`, {
        dateRange: `${chunkStartStr} to ${chunkEndStr}`,
        days: Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      });
      
      try {
        const chunkData = await this.querySearchConsole(
          siteUrl, 
          chunkStartStr, 
          chunkEndStr, 
          dimensions, 
          25000
        );
        
        // Check if we hit the 5K limit and warn about incomplete data
        if (chunkData.length === 5000) {
          console.warn(`🚨 5K Row Limit Hit for Chunk ${chunkCount}:`, {
            dateRange: `${chunkStartStr} to ${chunkEndStr}`,
            rowsReceived: chunkData.length,
            issue: 'This chunk likely has more data that was truncated',
            impact: 'Missing clicks/impressions for this date range',
            recommendation: 'Consider implementing hourly chunks or pagination'
          });
        }
        
        console.log(`✅ Chunk ${chunkCount} completed:`, {
          dateRange: `${chunkStartStr} to ${chunkEndStr}`,
          rowsReceived: chunkData.length,
          sampleDates: [...new Set(chunkData.map(d => d.date))].sort(),
          suspectedTruncation: chunkData.length === 5000
        });
        
        allData.push(...chunkData);
        
        // Small delay to avoid rate limiting
        if (chunkCount > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Failed to fetch chunk ${chunkCount} (${chunkStartStr} to ${chunkEndStr}):`, error);
        // Continue with other chunks even if one fails
      }
      
      // Move to next chunk
      currentStart = new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Calculate data completeness analysis
    const dataByDate = Object.fromEntries(
      [...new Set(allData.map(d => d.date))].map(date => [
        date, 
        allData.filter(d => d.date === date).length
      ])
    );
    
    const chunksHitting5KLimit = Object.values(dataByDate).filter(count => count === 5000).length;
    const potentialDataLoss = chunksHitting5KLimit > 0;
    
    console.log('🎉 GSC Chunking Complete:', {
      totalChunks: chunkCount,
      totalRows: allData.length,
      dateRange: `${startDate} to ${endDate}`,
      uniqueDates: [...new Set(allData.map(d => d.date))].sort(),
      dataByDate: dataByDate,
      dataLossAnalysis: {
        daysHitting5KLimit: chunksHitting5KLimit,
        totalDaysInRange: Object.keys(dataByDate).length,
        potentialDataLoss: potentialDataLoss,
        completenessEstimate: potentialDataLoss ? 
          `INCOMPLETE - ${chunksHitting5KLimit} days hit 5K row limit` : 
          'LIKELY COMPLETE',
        recommendation: potentialDataLoss ? 
          'Consider implementing pagination or more granular time-based chunking' : 
          'Data appears complete'
      }
    });
    
    return allData;
  }

  /**
   * Get time series data (day by day)
   */
  async getTimeSeriesData(
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions: string[] = ['date']
  ): Promise<GSCMetric[]> {
    try {
      // For time series, we need to include 'date' dimension
      if (!dimensions.includes('date')) {
        dimensions = ['date', ...dimensions];
      }

      const request = {
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions,
          rowLimit: 25000, // Higher limit for time series
          startRow: 0,
        },
      };

      const response = await this.searchconsole.searchanalytics.query(request);
      const data = response.data;

      if (!data.rows || data.rows.length === 0) {
        return [];
      }

      // Transform time series data to GSCMetric format
      return data.rows.map((row) => {
        const keys = row.keys || [];
        
        return {
          date: keys[0], // First dimension should be date
          query: dimensions.includes('query') ? keys[dimensions.indexOf('query')] || 'Total' : 'Total',
          page: dimensions.includes('page') ? keys[dimensions.indexOf('page')] : undefined,
          country: dimensions.includes('country') ? keys[dimensions.indexOf('country')] : undefined,
          device: dimensions.includes('device') ? keys[dimensions.indexOf('device')] : undefined,
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        };
      });
    } catch (error) {
      console.error('GSC Time Series Error:', error);
      throw new Error('Failed to get time series data from Google Search Console');
    }
  }

  /**
   * Clear stored credentials
   */
  clearCredentials(): void {
    this.auth.setCredentials({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gsc_tokens');
    }
  }
}

// Singleton instance
let gscClient: GSCClient | null = null;

export function getGSCClient(): GSCClient {
  if (!gscClient) {
    gscClient = new GSCClient();
  }
  return gscClient;
}
