import { NormalizedMetric } from './types';

// IndexedDB database name and version
const DB_NAME = 'PerformanceMetricsDB';
const DB_VERSION = 1;
const STORE_NAME = 'metrics';

// localStorage keys
const STORAGE_KEYS = {
  DATA_METADATA: 'performance_data_metadata',
  LAST_IMPORT: 'last_import_timestamp',
} as const;

export interface DataMetadata {
  gscImported: boolean;
  gscDateRange?: { startDate: string; endDate: string };
  gscImportTime?: string;
  gscDataCount?: number;
  ahrefsImported: boolean;
  ahrefsImportTime?: string;
  ahrefsDataCount?: number;
  totalDataPoints: number;
  lastUpdated: string;
}

/**
 * Initialize IndexedDB database
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('source', 'source', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('query', 'query', { unique: false });
      }
    };
  });
}

/**
 * Save data to IndexedDB
 */
export async function saveDataToStorage(data: NormalizedMetric[]): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Clear existing data
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    
    // Add new data
    for (const item of data) {
      await new Promise<void>((resolve, reject) => {
        const addRequest = store.add(item);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      });
    }
    
    // Update metadata
    const metadata = generateMetadata(data);
    localStorage.setItem(STORAGE_KEYS.DATA_METADATA, JSON.stringify(metadata));
    localStorage.setItem(STORAGE_KEYS.LAST_IMPORT, new Date().toISOString());
    
    console.log(`Saved ${data.length} data points to storage`);
  } catch (error) {
    console.error('Failed to save data to storage:', error);
    throw error;
  }
}

/**
 * Load data from IndexedDB
 */
export async function loadDataFromStorage(): Promise<NormalizedMetric[]> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise<NormalizedMetric[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const data = request.result.map(item => {
          // Remove the IndexedDB id field
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...normalizedItem } = item;
          return normalizedItem as NormalizedMetric;
        });
        console.log(`Loaded ${data.length} data points from storage`);
        resolve(data);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load data from storage:', error);
    return [];
  }
}

/**
 * Get data metadata from localStorage
 */
export function getDataMetadata(): DataMetadata | null {
  try {
    const metadata = localStorage.getItem(STORAGE_KEYS.DATA_METADATA);
    return metadata ? JSON.parse(metadata) : null;
  } catch (error) {
    console.error('Failed to get data metadata:', error);
    return null;
  }
}

/**
 * Clear all stored data
 */
export async function clearStoredData(): Promise<void> {
  try {
    // Clear IndexedDB
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.DATA_METADATA);
    localStorage.removeItem(STORAGE_KEYS.LAST_IMPORT);
    
    console.log('Cleared all stored data');
  } catch (error) {
    console.error('Failed to clear stored data:', error);
    throw error;
  }
}

/**
 * Check if storage is available and has data
 */
export function hasStoredData(): boolean {
  const metadata = getDataMetadata();
  return metadata !== null && metadata.totalDataPoints > 0;
}

/**
 * Generate metadata from data array
 */
function generateMetadata(data: NormalizedMetric[]): DataMetadata {
  const gscData = data.filter(item => item.source === 'gsc');
  const ahrefsData = data.filter(item => item.source === 'ahrefs');
  
  const metadata: DataMetadata = {
    gscImported: gscData.length > 0,
    ahrefsImported: ahrefsData.length > 0,
    totalDataPoints: data.length,
    lastUpdated: new Date().toISOString(),
  };
  
  if (gscData.length > 0) {
    const gscDates = gscData.map(item => item.date).sort();
    metadata.gscDateRange = {
      startDate: gscDates[0],
      endDate: gscDates[gscDates.length - 1],
    };
    metadata.gscDataCount = gscData.length;
    metadata.gscImportTime = new Date().toISOString();
  }
  
  if (ahrefsData.length > 0) {
    metadata.ahrefsDataCount = ahrefsData.length;
    metadata.ahrefsImportTime = new Date().toISOString();
  }
  
  return metadata;
}

/**
 * Get storage usage information
 */
export async function getStorageInfo(): Promise<{
  used: number;
  available: number;
  percentage: number;
}> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const available = estimate.quota || 0;
      const percentage = available > 0 ? (used / available) * 100 : 0;
      
      return { used, available, percentage };
    }
  } catch (error) {
    console.error('Failed to get storage info:', error);
  }
  
  return { used: 0, available: 0, percentage: 0 };
}
