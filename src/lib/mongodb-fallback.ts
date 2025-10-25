// Fallback for when MongoDB is not available
export const isMongoAvailable = async () => {
  try {
    const mongoose = await import('mongoose');
    const testConnection = await mongoose.default.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/brandmonitorai', {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });
    await mongoose.default.disconnect();
    return true;
  } catch (error) {
    console.warn('MongoDB not available:', error);
    return false;
  }
};

export const createMockUser = (email: string, password: string) => {
  // Simple in-memory storage for development
  const users = new Map();
  
  return {
    async findOne(query: any) {
      const user = users.get(query.email);
      return user || null;
    },
    
    async save() {
      return { _id: 'mock-id', email: this.email };
    },
    
    async insertOne(userData: any) {
      users.set(userData.email, userData);
      return { insertedId: 'mock-id' };
    }
  };
};
