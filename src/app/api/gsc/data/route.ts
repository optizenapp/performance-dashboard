import { NextRequest, NextResponse } from 'next/server';
import { getGSCClient } from '@/lib/gsc-client';

export async function POST(request: NextRequest) {
  try {
    const { siteUrl, startDate, endDate, dimensions, timeSeries } = await request.json();
    
    if (!siteUrl || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'siteUrl, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const gscClient = getGSCClient();
    
    // Check if authenticated
    if (!gscClient.isAuthenticated()) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Search Console' },
        { status: 401 }
      );
    }

    let data;
    if (timeSeries) {
      // Get time series data for charts
      data = await gscClient.getTimeSeriesData(
        siteUrl,
        startDate,
        endDate,
        dimensions || ['date']
      );
    } else {
      // Get aggregated performance data for tables
      data = await gscClient.getPerformanceData(
        siteUrl,
        startDate,
        endDate,
        dimensions || ['query', 'page']
      );
    }
    
    // Debug logging
    console.log('GSC API Response:', {
      timeSeries,
      dimensions: dimensions || (timeSeries ? ['date'] : ['query', 'page']),
      dataCount: data.length,
      sampleData: data.slice(0, 3),
      siteUrl
    });
    
    return NextResponse.json({ 
      success: true, 
      data,
      count: data.length 
    });
  } catch (error) {
    console.error('GSC Data Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve data from Google Search Console' },
      { status: 500 }
    );
  }
}
