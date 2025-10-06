import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connectionString = process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    console.log("Connecting to MongoDB...");
    const connectionInstance = await mongoose.connect(connectionString, {
      dbName: process.env.DB_NAME || "myapp",
    });

    console.log(`MongoDB connected: ${connectionInstance.connection.host}`);
    return connectionInstance;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
};

export default connectDB;