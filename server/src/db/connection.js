import mongoose from 'mongoose';

let isConnected = false;
const inMemoryStore = {
  sessions: new Map(),
  logs: []
};

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('[MERN Database] MONGODB_URI not specified. Operating with resilient in-memory session persistence.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 1500
    });
    isConnected = true;
    console.log('[MERN Database] Connected to MongoDB database at:', uri);
  } catch (err) {
    isConnected = false;
    console.log('[MERN Database] Notice: MongoDB connection failed. Falling back to resilient in-memory persistence.');
  }
}

export function isDbConnected() {
  return isConnected;
}

export { inMemoryStore };
