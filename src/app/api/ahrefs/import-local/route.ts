import { NextRequest, NextResponse } from 'next/server';
import { parseAhrefsCSV } from '@/lib/csv-parser';
import { normalizeAhrefsData } from '@/lib/data-utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'CSV file is required' },
        { status: 400 }
      );
    }

    console.log('🚀 Starting Ahrefs CSV parsing:', {
      fileName: file.name,
      fileSize: file.size
    });

    // Parse CSV file
    const fileText = await file.text();
    const parseResult = await parseAhrefsCSV(fileText);
    
    if (!parseResult.success || !parseResult.data) {
      return NextResponse.json(
        { 
          error: 'Failed to parse CSV file',
          details: parseResult.errors 
        },
        { status: 400 }
      );
    }

    console.log('📊 CSV parsed successfully:', {
      recordCount: parseResult.data.length,
      validRows: parseResult.validRows,
      sampleRecord: parseResult.data[0]
    });

    // Normalize the data
    const normalizedData = normalizeAhrefsData(parseResult.data);

    console.log('✅ Ahrefs import completed successfully:', {
      totalRecords: normalizedData.length,
      fileName: file.name,
      sampleNormalizedData: normalizedData.slice(0, 3)
    });

    return NextResponse.json({
      success: true,
      data: normalizedData,
      recordCount: normalizedData.length,
      fileName: file.name,
      message: 'Ahrefs data parsed successfully'
    });

  } catch (error) {
    console.error('Ahrefs Import Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to import Ahrefs data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

