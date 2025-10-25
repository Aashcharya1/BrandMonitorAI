import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { generateTokenPair } from '@/lib/jwt';

// Simple in-memory storage for development fallback
// Using global to persist across requests
declare global {
  var __users: Map<string, any>;
}

// Initialize global users map if it doesn't exist
if (!global.__users) {
  global.__users = new Map();
}
const users = global.__users;

// Debug function to check users
const debugUsers = () => {
  console.log('Current users in memory:', Array.from(users.keys()));
};

export async function POST(request: NextRequest) {
  try {
    // Try to connect to MongoDB, fallback to in-memory storage
    let useMongoDB = true;
    try {
      await connectDB();
    } catch (error) {
      console.warn('MongoDB not available, using in-memory storage:', error);
      useMongoDB = false;
    }

    const { email, password } = await request.json();

        // Validate input
        if (!email || !password) {
          return NextResponse.json(
            { message: 'Email and password are required' },
            { status: 400 }
          );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { message: 'Please enter a valid email address' },
            { status: 400 }
          );
        }

    // Find user
    let user;
    if (useMongoDB) {
      user = await User.findOne({ email });
    } else {
      console.log('Looking for user in memory:', email);
      debugUsers();
      user = users.get(email);
      console.log('User found:', user ? 'Yes' : 'No');
    }
    
    if (!user) {
      console.log('User not found for email:', email);
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate tokens
    const tokens = generateTokenPair({
      userId: useMongoDB ? user._id.toString() : user.id,
      email: user.email,
    });

    // Store refresh token
    if (useMongoDB) {
      user.refreshTokens.push(tokens.refreshToken);
      await user.save();
    }

    return NextResponse.json({
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: useMongoDB ? user._id.toString() : user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
