import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connectionString = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || "myapp";

    if (!connectionString) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    console.log(`Attempting to connect to MongoDB at ${connectionString}/${dbName}...`);

    // Set Mongoose options to avoid buffering issues
    mongoose.set("bufferCommands", false); // Disable buffering
    const connectionInstance = await mongoose.connect(connectionString, {
      dbName,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      connectTimeoutMS: 10000, // Connection timeout
    });

    console.log(`MongoDB connected: ${connectionInstance.connection.host}`);
    return connectionInstance;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
};

export default connectDB;