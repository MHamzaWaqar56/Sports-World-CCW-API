import mongoose from 'mongoose';

let connectPromise = null;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured. Refusing to start without a persistent database.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  try {
    connectPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });

    const conn = await connectPromise;

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    connectPromise = null;
    throw error;
  }
};

export default connectDB;