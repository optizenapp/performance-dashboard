import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoose } from '@/lib/mongodb';
import { DataImport } from '@/lib/models/gsc-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');
    const source = searchParams.get('source') as 'gsc' | 'ahrefs' | undefined;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Connect to MongoDB
    await connectToMongoose();

    // Build query
    const query: any = {};
    if (siteUrl) query.siteUrl = siteUrl;
    if (source) query.source = source;
    if (status) query.status = status;

    // Get imports
    const imports = await DataImport.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    console.log('📊 Import History Query:', {
      query,
      importsFound: imports.length
    });

    return NextResponse.json({
      success: true,
      imports: imports.map(imp => ({
        importId: imp.importId,
        source: imp.source,
        siteUrl: imp.siteUrl,
        startDate: imp.startDate,
        endDate: imp.endDate,
        fileName: imp.fileName,
        recordCount: imp.recordCount,
        status: imp.status,
        createdAt: imp.createdAt,
        completedAt: imp.completedAt,
        error: imp.error,
        dimensions: imp.dimensions,
        replacedPreviousData: imp.replacedPreviousData
      }))
    });

  } catch (error) {
    console.error('Import History Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve import history' },
      { status: 500 }
    );
  }
}
