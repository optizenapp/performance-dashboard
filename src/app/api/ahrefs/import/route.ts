import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoose } from '@/lib/mongodb';
import { ReportingData, DataImport } from '@/lib/models/gsc-data';
import { ahrefsDataToMongoDB, generateImportId, clearExistingData } from '@/lib/mongodb-utils';
import { parseAhrefsCSV } from '@/lib/csv-parser';

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

    // Connect to MongoDB
    await connectToMongoose();

    // Generate unique import ID
    const importId = generateImportId('ahrefs', file.name);
    
    console.log('🚀 Starting Ahrefs import to MongoDB:', {
      importId,
      fileName: file.name,
      fileSize: file.size
    });

    // Clear existing Ahrefs data (replace on import strategy)
    console.log('🗑️ Clearing existing Ahrefs data...');
    const deletedCount = await clearExistingData('ahrefs');
    
    // Create import record
    const importRecord = new DataImport({
      importId,
      source: 'ahrefs',
      fileName: file.name,
      status: 'pending',
      replacedPreviousData: deletedCount > 0
    });
    await importRecord.save();

    try {
      // Parse CSV file
      console.log('📊 Parsing Ahrefs CSV file...');
      const fileText = await file.text();
      const ahrefsData = parseAhrefsCSV(fileText);
      
      console.log('📊 CSV parsed successfully:', {
        recordCount: ahrefsData.length,
        sampleRecord: ahrefsData[0]
      });

      // Convert to MongoDB format
      const mongoData = ahrefsDataToMongoDB(ahrefsData, importId, file.name);

      console.log('💾 Saving to MongoDB:', {
        documentsToSave: mongoData.length,
        estimatedSize: `${Math.round(mongoData.length * 0.5)}KB`
      });

      // Save to MongoDB in batches to avoid memory issues
      const batchSize = 1000;
      let savedCount = 0;
      
      for (let i = 0; i < mongoData.length; i += batchSize) {
        const batch = mongoData.slice(i, i + batchSize);
        await ReportingData.insertMany(batch);
        savedCount += batch.length;
        
        console.log(`💾 Saved batch: ${savedCount}/${mongoData.length} documents`);
      }

      // Update import record
      importRecord.status = 'completed';
      importRecord.recordCount = savedCount;
      importRecord.completedAt = new Date();
      await importRecord.save();

      console.log('✅ Ahrefs import completed successfully:', {
        importId,
        totalRecords: savedCount,
        replacedRecords: deletedCount,
        timeElapsed: `${Date.now() - new Date(importRecord.createdAt).getTime()}ms`
      });

      return NextResponse.json({
        success: true,
        importId,
        recordCount: savedCount,
        fileName: file.name,
        replacedRecords: deletedCount,
        message: 'Ahrefs data imported successfully to MongoDB'
      });

    } catch (error) {
      // Update import record with error
      importRecord.status = 'failed';
      importRecord.error = error instanceof Error ? error.message : 'Unknown error';
      await importRecord.save();
      
      throw error;
    }

  } catch (error) {
    console.error('Ahrefs Import Error:', error);
    return NextResponse.json(
      { error: 'Failed to import Ahrefs CSV data' },
      { status: 500 }
    );
  }
}

