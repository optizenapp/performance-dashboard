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
        : 'http://localhost:3000/api/auth/callback'
      );
    
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
    
    // Store tokens in localStorage for persistence (client-side only)
    if (typeof window !== 'undefined') {
      localStorage.setItem('gsc_tokens', JSON.stringify(tokens));
    }
    
    // For server-side, we'll store in a simple in-memory cache
    // In production, you'd want to use a proper database or session storage
    if (typeof window === 'undefined') {
      global.gscTokens = tokens;
    }
  }

  /**
   * Load stored credentials from localStorage or server cache
   */
  loadStoredCredentials(): boolean {
    // Client-side: use localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gsc_tokens');
      if (stored) {
        try {
          const tokens = JSON.parse(stored);
          this.auth.setCredentials(tokens);
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
      return true;
    }
    
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
    rowLimit: number = 1000
  ): Promise<GSCMetric[]> {
    try {
      const request = {
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions,
          rowLimit,
          startRow: 0,
        },
      };

      console.log('GSC API Request:', {
        siteUrl,
        startDate,
        endDate,
        dimensions,
        rowLimit,
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
        firstRow: data?.rows?.[0],
        responseStatus: response.status
      });

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
      return data.rows.map((row) => {
        const keys = row.keys || [];
        
        // For aggregated queries, GSC doesn't return individual dates. Since this is aggregated data
        // representing the entire date range, we'll use the end date to ensure it appears in filters.
        // This represents "data through this end date" which is more accurate for aggregated metrics.
        
        // Log the date assignment for the first row only
        if (data.rows && data.rows.indexOf(row) === 0) {
          console.log('📅 GSC Date Assignment:', {
            originalRange: `${startDate} to ${endDate}`,
            assignedDate: endDate,
            reason: 'Using end date for aggregated data to ensure visibility in date filters'
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
   * Get performance data for date range
   */
  async getPerformanceData(
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions: string[] = ['query', 'page']
  ): Promise<GSCMetric[]> {
    return await this.querySearchConsole(siteUrl, startDate, endDate, dimensions);
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
