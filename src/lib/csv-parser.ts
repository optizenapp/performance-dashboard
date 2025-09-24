import Papa from 'papaparse';
import { AhrefsMetric, AhrefsMetricSchema } from './types';

export interface CSVParseResult {
  success: boolean;
  data?: AhrefsMetric[];
  errors?: string[];
  totalRows?: number;
  validRows?: number;
}

/**
 * Common Ahrefs CSV column mappings
 */
const AHREFS_COLUMN_MAPPINGS = {
  // Standard Ahrefs export columns
  keyword: ['keyword', 'query', 'search term', 'term'],
  url: ['url', 'page', 'landing page', 'target url'],
  position: ['position', 'rank', 'ranking', 'avg position'],
  volume: ['volume', 'search volume', 'monthly searches', 'searches'],
  difficulty: ['difficulty', 'kd', 'keyword difficulty', 'competition'],
  cpc: ['cpc', 'cost per click', 'avg cpc', 'price'],
  traffic: ['traffic', 'organic traffic', 'estimated traffic', 'visits'],
  date: ['date', 'month', 'period', 'time'],
};

/**
 * Find the best matching column name for a given field
 */
function findColumnMatch(headers: string[], fieldMappings: string[]): string | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  for (const mapping of fieldMappings) {
    const index = normalizedHeaders.findIndex(header => 
      header.includes(mapping.toLowerCase()) || mapping.toLowerCase().includes(header)
    );
    if (index !== -1) {
      return headers[index];
    }
  }
  
  return null;
}

/**
 * Parse a numeric value from a string, handling various formats
 */
function parseNumericValue(value: string | number): number | undefined {
  if (typeof value === 'number') return value;
  if (!value || value === '') return undefined;
  
  // Remove common non-numeric characters
  const cleaned = value.toString()
    .replace(/[$,%]/g, '')
    .replace(/[<>]/g, '')
    .trim();
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse date value, handling various formats
 */
function parseDateValue(value: string): string {
  if (!value) return new Date().toISOString().split('T')[0];
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      // If parsing fails, use current date
      return new Date().toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Parse Ahrefs CSV data
 */
export function parseAhrefsCSV(csvContent: string): Promise<CSVParseResult> {
  return new Promise((resolve) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        try {
          const { data, errors: parseErrors } = results;
          const headers = Object.keys(data[0] || {});
          
          if (headers.length === 0) {
            resolve({
              success: false,
              errors: ['No headers found in CSV file'],
            });
            return;
          }

          // Find column mappings
          const columnMappings = {
            keyword: findColumnMatch(headers, AHREFS_COLUMN_MAPPINGS.keyword),
            url: findColumnMatch(headers, AHREFS_COLUMN_MAPPINGS.url),
            position: findColumnMatch(headers, AHREFS_COLUMN_MAPPINGS.position),
            volume: findColumnMatch(headers, AHREFS_COLUMN_MAPPINGS.volume),
            difficulty: findColumnMatch(headers, AHREFS_COLUMN_MAPPINGS.difficulty),
            cpc: findColumnMatch(headers, AHREFS_COLUMN_MAPPINGS.cpc),
            traffic: findColumnMatch(headers, AHREFS_COLUMN_MAPPINGS.traffic),
            date: findColumnMatch(headers, AHREFS_COLUMN_MAPPINGS.date),
          };

          // Check if we have required columns
          if (!columnMappings.keyword) {
            resolve({
              success: false,
              errors: ['Required column "keyword" not found. Available columns: ' + headers.join(', ')],
            });
            return;
          }

          if (!columnMappings.position) {
            resolve({
              success: false,
              errors: ['Required column "position" not found. Available columns: ' + headers.join(', ')],
            });
            return;
          }

          // Process rows
          const processedData: AhrefsMetric[] = [];
          const errors: string[] = [];
          let validRows = 0;

          (data as Record<string, string | number>[]).forEach((row, index: number) => {
            try {
              const keyword = row[columnMappings.keyword!]?.toString().trim();
              if (!keyword) {
                errors.push(`Row ${index + 2}: Missing keyword`);
                return;
              }

              const position = parseNumericValue(row[columnMappings.position!]);
              if (position === undefined) {
                errors.push(`Row ${index + 2}: Invalid position value`);
                return;
              }

              const ahrefsMetric: AhrefsMetric = {
                date: columnMappings.date 
                  ? parseDateValue(row[columnMappings.date]?.toString() || '')
                  : new Date().toISOString().split('T')[0],
                keyword,
                url: columnMappings.url ? row[columnMappings.url]?.toString().trim() : undefined,
                position,
                volume: columnMappings.volume ? parseNumericValue(row[columnMappings.volume]) : undefined,
                difficulty: columnMappings.difficulty ? parseNumericValue(row[columnMappings.difficulty]) : undefined,
                cpc: columnMappings.cpc ? parseNumericValue(row[columnMappings.cpc]) : undefined,
                traffic: columnMappings.traffic ? parseNumericValue(row[columnMappings.traffic]) : undefined,
              };

              // Validate with Zod schema
              const validated = AhrefsMetricSchema.safeParse(ahrefsMetric);
              if (validated.success) {
                processedData.push(validated.data);
                validRows++;
              } else {
                errors.push(`Row ${index + 2}: ${validated.error.issues.map(e => e.message).join(', ')}`);
              }
            } catch (error) {
              errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          });

          // Include Papa Parse errors
          if (parseErrors.length > 0) {
            parseErrors.forEach(error => {
              errors.push(`Parse error: ${error.message} at row ${error.row}`);
            });
          }

          resolve({
            success: processedData.length > 0,
            data: processedData,
            errors: errors.length > 0 ? errors : undefined,
            totalRows: data.length,
            validRows,
          });

        } catch (error) {
          resolve({
            success: false,
            errors: [error instanceof Error ? error.message : 'Unknown parsing error'],
          });
        }
      },
      error: (error: Error) => {
        resolve({
          success: false,
          errors: [error.message || 'Failed to parse CSV'],
        });
      },
    });
  });
}

/**
 * Validate CSV file before parsing
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.includes('csv') && !file.name.toLowerCase().endsWith('.csv')) {
    return { valid: false, error: 'Please select a CSV file' };
  }

  // Check file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }

  return { valid: true };
}

/**
 * Read file content as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result as string);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsText(file);
  });
}

/**
 * Generate sample CSV for download
 */
export function generateSampleCSV(): string {
  const headers = ['keyword', 'url', 'position', 'volume', 'difficulty', 'cpc', 'traffic', 'date'];
  const sampleRows = [
    ['seo reporting tool', '/seo-tools', '3', '1200', '45', '2.50', '180', '2024-01-01'],
    ['keyword research', '/blog/keyword-research', '7', '800', '35', '1.80', '120', '2024-01-01'],
    ['search console api', '/api-docs', '12', '500', '25', '3.20', '80', '2024-01-01'],
  ];

  return [headers, ...sampleRows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}
