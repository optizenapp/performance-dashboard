import mongoose, { Schema, Document } from 'mongoose';

// Interface for both GSC and Ahrefs data (matching your current NormalizedMetric type)
export interface IReportingData extends Document {
  // Import metadata
  importId: string;
  siteUrl?: string; // Optional for Ahrefs data
  importedAt: Date;
  
  // Common data fields
  date: string;
  query?: string;
  url?: string;
  page?: string;
  country?: string;
  device?: string;
  
  // GSC Metrics
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  
  // Ahrefs Metrics
  volume?: number;
  traffic?: number;
  difficulty?: number;
  cpc?: number;
  serpFeatures?: string;
  
  // Ahrefs Comparison fields
  previousTraffic?: number;
  previousPosition?: number;
  previousDate?: string;
  trafficChange?: number;
  positionChange?: number;
  
  // Normalized fields (matching your current NormalizedMetric)
  source: 'gsc' | 'ahrefs';
  metric_type?: 'clicks' | 'impressions' | 'ctr' | 'position' | 'volume' | 'traffic';
  value?: number;
  
  // Additional metadata
  dimensions?: string[];
  isTimeSeries?: boolean;
}

const ReportingDataSchema = new Schema<IReportingData>({
  // Import metadata
  importId: { type: String, required: true, index: true },
  siteUrl: { type: String, index: true }, // Optional for Ahrefs
  importedAt: { type: Date, default: Date.now, index: true },
  
  // Common data fields
  date: { type: String, required: true, index: true },
  query: { type: String, index: true },
  url: { type: String, index: true },
  page: { type: String, index: true },
  country: { type: String, index: true },
  device: { type: String, index: true },
  
  // GSC Metrics (optional)
  clicks: { type: Number },
  impressions: { type: Number },
  ctr: { type: Number },
  position: { type: Number },
  
  // Ahrefs Metrics (optional)
  volume: { type: Number },
  traffic: { type: Number },
  difficulty: { type: Number },
  cpc: { type: Number },
  serpFeatures: { type: String },
  
  // Ahrefs Comparison fields (optional)
  previousTraffic: { type: Number },
  previousPosition: { type: Number },
  previousDate: { type: String },
  trafficChange: { type: Number },
  positionChange: { type: Number },
  
  // Normalized fields (optional for new unified approach)
  source: { type: String, required: true, enum: ['gsc', 'ahrefs'], index: true },
  metric_type: { type: String, enum: ['clicks', 'impressions', 'ctr', 'position', 'volume', 'traffic'], index: true },
  value: { type: Number },
  
  // Additional metadata
  dimensions: [{ type: String }],
  isTimeSeries: { type: Boolean, default: false, index: true }
}, {
  timestamps: true,
  collection: 'reporting_data'
});

// Compound indexes for efficient querying
ReportingDataSchema.index({ source: 1, date: 1 });
ReportingDataSchema.index({ importId: 1, source: 1 });
ReportingDataSchema.index({ siteUrl: 1, date: 1 });
ReportingDataSchema.index({ siteUrl: 1, date: 1, query: 1 });
ReportingDataSchema.index({ source: 1, date: 1, query: 1 });

// Export the unified model
export const ReportingData = mongoose.models.ReportingData || mongoose.model<IReportingData>('ReportingData', ReportingDataSchema);

// Keep GSCData as alias for backward compatibility
export const GSCData = ReportingData;

// Import tracking schema for both GSC and Ahrefs
export interface IDataImport extends Document {
  importId: string;
  source: 'gsc' | 'ahrefs';
  siteUrl?: string; // Optional for Ahrefs
  startDate?: string; // Optional for Ahrefs (point-in-time data)
  endDate?: string; // Optional for Ahrefs
  fileName?: string; // For Ahrefs CSV files
  dimensions?: string[];
  recordCount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  replacedPreviousData: boolean; // Track if this import replaced existing data
}

const DataImportSchema = new Schema<IDataImport>({
  importId: { type: String, required: true, unique: true },
  source: { type: String, required: true, enum: ['gsc', 'ahrefs'] },
  siteUrl: { type: String }, // Optional for Ahrefs
  startDate: { type: String }, // Optional for Ahrefs
  endDate: { type: String }, // Optional for Ahrefs
  fileName: { type: String }, // For Ahrefs CSV files
  dimensions: [{ type: String }],
  recordCount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  error: { type: String },
  replacedPreviousData: { type: Boolean, default: false }
}, {
  collection: 'data_imports'
});

export const DataImport = mongoose.models.DataImport || mongoose.model<IDataImport>('DataImport', DataImportSchema);

// Keep GSCImport as alias for backward compatibility
export const GSCImport = DataImport;
