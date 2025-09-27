import { NextRequest, NextResponse } from 'next/server';
import { getGSCClient } from '@/lib/gsc-client';
import { connectToMongoose } from '@/lib/mongodb';
import { ReportingData, DataImport } from '@/lib/models/gsc-data';
import { gscRawDataToMongoDB, generateImportId, clearExistingData } from '@/lib/mongodb-utils';

export async function POST(request: NextRequest) {
  try {
    const { siteUrl, startDate, endDate } = await request.json();
    
    if (!siteUrl || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'siteUrl, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectToMongoose();

    const gscClient = getGSCClient();
    
    // Try to load stored credentials
    const hasCredentials = gscClient.loadStoredCredentials();
    
    console.log('GSC Import API - Auth Check:', {
      hasCredentials,
      isAuthenticated: gscClient.isAuthenticated(),
      globalTokens: !!global.gscTokens
    });
    
    // Check if authenticated
    if (!gscClient.isAuthenticated()) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Search Console' },
        { status: 401 }
      );
    }

    // Generate unique import ID
    const importId = generateImportId('gsc', siteUrl, startDate, endDate);
    
    console.log('🚀 Starting GSC import to MongoDB:', {
      importId,
      siteUrl,
      dateRange: `${startDate} to ${endDate}`
    });

    // Clear existing GSC data for this site (replace on import strategy)
    console.log('🗑️ Clearing existing GSC data for site:', siteUrl);
    const deletedCount = await clearExistingData('gsc', siteUrl);
    
    // Create import record
    const importRecord = new DataImport({
      importId,
      source: 'gsc',
      siteUrl,
      startDate,
      endDate,
      dimensions: ['date', 'query', 'page'],
      status: 'pending',
      replacedPreviousData: deletedCount > 0
    });
    await importRecord.save();

    try {
      // Fetch time series data (for charts)
      console.log('📊 Fetching time series data...');
      const timeSeriesData = await gscClient.getTimeSeriesData(
        siteUrl,
        startDate,
        endDate,
        ['date']
      );
      
      // Fetch detailed query/page data (for tables)
      console.log('📊 Fetching query/page data...');
      const queryPageData = await gscClient.getPerformanceData(
        siteUrl,
        startDate,
        endDate,
        ['date', 'query', 'page']
      );

      console.log('📊 Data fetched successfully:', {
        timeSeriesCount: timeSeriesData.length,
        queryPageCount: queryPageData.length,
        totalRecords: timeSeriesData.length + queryPageData.length
      });

      // Convert to MongoDB format
      const timeSeriesMongoData = gscRawDataToMongoDB(
        timeSeriesData,
        importId,
        siteUrl,
        ['date'],
        true
      );
      
      const queryPageMongoData = gscRawDataToMongoDB(
        queryPageData,
        importId,
        siteUrl,
        ['date', 'query', 'page'],
        false
      );

      const allMongoData = [...timeSeriesMongoData, ...queryPageMongoData];

      console.log('💾 Saving to MongoDB:', {
        documentsToSave: allMongoData.length,
        estimatedSize: `${Math.round(allMongoData.length * 0.5)}KB`
      });

      // Save to MongoDB in batches to avoid memory issues
      const batchSize = 1000;
      let savedCount = 0;
      
      for (let i = 0; i < allMongoData.length; i += batchSize) {
        const batch = allMongoData.slice(i, i + batchSize);
        await ReportingData.insertMany(batch);
        savedCount += batch.length;
        
        console.log(`💾 Saved batch: ${savedCount}/${allMongoData.length} documents`);
      }

      // Update import record
      importRecord.status = 'completed';
      importRecord.recordCount = savedCount;
      importRecord.completedAt = new Date();
      await importRecord.save();

      console.log('✅ GSC import completed successfully:', {
        importId,
        totalRecords: savedCount,
        timeElapsed: `${Date.now() - new Date(importRecord.createdAt).getTime()}ms`
      });

      return NextResponse.json({
        success: true,
        importId,
        recordCount: savedCount,
        timeSeriesCount: timeSeriesMongoData.length,
        queryPageCount: queryPageMongoData.length,
        message: 'Data imported successfully to MongoDB'
      });

    } catch (error) {
      // Update import record with error
      importRecord.status = 'failed';
      importRecord.error = error instanceof Error ? error.message : 'Unknown error';
      await importRecord.save();
      
      throw error;
    }

  } catch (error) {
    console.error('GSC Import Error:', error);
    return NextResponse.json(
      { error: 'Failed to import data from Google Search Console' },
      { status: 500 }
    );
  }
}
