import { MongoClient, Db } from 'mongodb';
import mongoose from 'mongoose';

// MongoDB connection string - you can use MongoDB Atlas (free tier) or local MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gsc-reporting';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

// Global variable to cache the connection
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * Connect to MongoDB using native driver
 */
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  
  const db = client.db();
  
  cachedClient = client;
  cachedDb = db;
  
  return { client, db };
}

/**
 * Connect to MongoDB using Mongoose (for schema-based operations)
 */
export async function connectToMongoose(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState >= 1) {
    return mongoose;
  }

  return mongoose.connect(MONGODB_URI);
}

/**
 * Close database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

