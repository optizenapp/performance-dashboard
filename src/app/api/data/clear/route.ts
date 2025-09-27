import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoose } from '@/lib/mongodb';
import { ReportingData, DataImport } from '@/lib/models/gsc-data';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') as 'gsc' | 'ahrefs' | 'all';
    const siteUrl = searchParams.get('siteUrl');

    // Connect to MongoDB
    await connectToMongoose();

    let dataDeleteResult;
    let importDeleteResult;

    if (source === 'all') {
      // Clear all data
      console.log('🗑️ Clearing ALL data from MongoDB...');
      dataDeleteResult = await ReportingData.deleteMany({});
      importDeleteResult = await DataImport.deleteMany({});
    } else {
      // Clear specific source data
      const dataQuery: any = { source };
      const importQuery: any = { source };
      
      if (siteUrl && source === 'gsc') {
        dataQuery.siteUrl = siteUrl;
        importQuery.siteUrl = siteUrl;
      }

      console.log(`🗑️ Clearing ${source.toUpperCase()} data from MongoDB...`, {
        dataQuery,
        siteUrl: siteUrl || 'all sites'
      });

      dataDeleteResult = await ReportingData.deleteMany(dataQuery);
      importDeleteResult = await DataImport.deleteMany(importQuery);
    }

    console.log('✅ Database cleared successfully:', {
      dataRecordsDeleted: dataDeleteResult.deletedCount,
      importRecordsDeleted: importDeleteResult.deletedCount,
      source: source || 'all',
      siteUrl: siteUrl || 'all sites'
    });

    return NextResponse.json({
      success: true,
      dataRecordsDeleted: dataDeleteResult.deletedCount,
      importRecordsDeleted: importDeleteResult.deletedCount,
      source: source || 'all',
      siteUrl: siteUrl || 'all sites',
      message: `Successfully cleared ${source === 'all' ? 'all' : source.toUpperCase()} data from database`
    });

  } catch (error) {
    console.error('Database Clear Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear database' },
      { status: 500 }
    );
  }
}

