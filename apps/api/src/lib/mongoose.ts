import mongoose from "mongoose";
import dns from "node:dns";

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch {
  // fallback if DNS setting isn't permitted in current runtime
}

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    }).catch((err) => {
      connectionPromise = null;
      console.error("[MongoDB] Connection error:", err.message);
      throw err;
    });
  }
  return connectionPromise;
}
