import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoose } from '@/lib/mongodb';
import { ReportingData } from '@/lib/models/gsc-data';
import { buildMongoQuery, mongoDBToNormalizedMetrics } from '@/lib/mongodb-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const filters = {
      siteUrl: searchParams.get('siteUrl') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      query: searchParams.get('query') || undefined,
      page: searchParams.get('page') || undefined,
      source: searchParams.get('source') || 'gsc',
      metricTypes: searchParams.get('metricTypes')?.split(',') || undefined,
      importId: searchParams.get('importId') || undefined
    };
    
    // Special handling for initial data load - get a sample across all dates
    const isInitialLoad = searchParams.get('initialLoad') === 'true';
    
    // Pagination
    const page = parseInt(searchParams.get('pageNum') || '1');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const skip = (page - 1) * limit;
    
    console.log('📊 MongoDB Data Query:', {
      filters,
      pagination: { page, limit, skip }
    });

    // Connect to MongoDB
    await connectToMongoose();

    // Build MongoDB query
    const mongoQuery = buildMongoQuery(filters);
    
    console.log('🔍 MongoDB Query:', mongoQuery);

    let data, totalCount;
    
    if (isInitialLoad) {
      // For initial load, get a representative sample across all dates
      console.log('📊 Initial load - getting representative sample across all dates');
      
      // First get all unique dates
      const uniqueDates = await ReportingData.distinct('date', mongoQuery);
      console.log('📅 Found unique dates:', uniqueDates.length);
      
      // Sample data from different dates to get a good spread
      const samplesPerDate = Math.max(1, Math.floor(limit / uniqueDates.length));
      console.log('📊 Samples per date:', samplesPerDate);
      
      const sampleData = [];
      for (const date of uniqueDates.sort()) {
        const dateQuery = { ...mongoQuery, date };
        const dateSample = await ReportingData.find(dateQuery)
          .limit(samplesPerDate)
          .lean();
        sampleData.push(...dateSample);
        
        if (sampleData.length >= limit) break;
      }
      
      data = sampleData.slice(0, limit);
      totalCount = await ReportingData.countDocuments(mongoQuery);
      
    } else {
      // Regular pagination for filtered queries
      [data, totalCount] = await Promise.all([
        ReportingData.find(mongoQuery)
          .sort({ date: 1, query: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ReportingData.countDocuments(mongoQuery)
      ]);
    }

    console.log('📊 MongoDB Query Results:', {
      documentsFound: data.length,
      totalDocuments: totalCount,
      hasMore: skip + data.length < totalCount
    });

    // Convert to NormalizedMetric format (matching your current frontend)
    const normalizedData = mongoDBToNormalizedMetrics(data as any[]);

    console.log('📊 Data conversion debug:', {
      totalRawRecords: data.length,
      totalNormalizedRecords: normalizedData.length,
      rawDataSample: data.slice(0, 2),
      normalizedSample: normalizedData.slice(0, 2),
      uniqueDateCount: new Set(data.map(item => item.date)).size,
      firstDate: data.length > 0 ? data[0].date : null,
      lastDate: data.length > 0 ? data[data.length - 1].date : null,
      metricTypeCount: new Set(data.map(item => item.metric_type)).size,
      siteUrlCount: new Set(data.map(item => item.siteUrl)).size,
      queryCount: new Set(data.map(item => item.query)).size
    });

    return NextResponse.json({
      success: true,
      data: normalizedData,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore: skip + data.length < totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      filters: filters
    });

  } catch (error) {
    console.error('MongoDB Data Query Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve data from MongoDB' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support POST for complex queries
    const filters = {
      siteUrl: body.siteUrl,
      startDate: body.startDate,
      endDate: body.endDate,
      query: body.query,
      page: body.page,
      source: body.source || 'gsc',
      metricTypes: body.metricTypes,
      importId: body.importId
    };
    
    const page = body.page || 1;
    const limit = body.limit || 1000;
    const skip = (page - 1) * limit;

    console.log('📊 MongoDB Data Query (POST):', {
      filters,
      pagination: { page, limit, skip }
    });

    // Connect to MongoDB
    await connectToMongoose();

    // Build MongoDB query
    const mongoQuery = buildMongoQuery(filters);

    // Execute query
    const [data, totalCount] = await Promise.all([
      ReportingData.find(mongoQuery)
        .sort({ date: -1, query: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReportingData.countDocuments(mongoQuery)
    ]);

    // Convert to NormalizedMetric format
    const normalizedData = mongoDBToNormalizedMetrics(data as any[]);

    return NextResponse.json({
      success: true,
      data: normalizedData,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore: skip + data.length < totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      filters: filters
    });

  } catch (error) {
    console.error('MongoDB Data Query Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve data from MongoDB' },
      { status: 500 }
    );
  }
}
