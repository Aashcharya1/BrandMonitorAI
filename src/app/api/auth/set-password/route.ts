import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

// Simple in-memory storage for development fallback
declare global {
  var __users: Map<string, any>;
}

// Initialize global users map if it doesn't exist
if (!global.__users) {
  global.__users = new Map();
}
const users = global.__users;

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

    const { email, password, confirmPassword } = await request.json();

    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { message: 'Email, password, and confirmation are required' },
        { status: 400 }
      );
    }

    // Validate password match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { message: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Find user
    let user;
    if (useMongoDB) {
      user = await User.findOne({ email });
    } else {
      user = users.get(email);
    }

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has verified OTP
    if (!user.otpVerified) {
      return NextResponse.json(
        { message: 'Please verify your OTP first' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user with password
    user.password = hashedPassword;
    user.emailVerified = true; // Mark email as verified since OTP was verified
    user.emailVerifiedAt = new Date();
    user.otpVerified = false; // Reset OTP verification status
    
    if (useMongoDB) {
      await user.save();
    } else {
      users.set(email, user);
    }

    console.log('Password set successfully for:', email);

    return NextResponse.json({
      message: 'Password set successfully. You can now log in.',
      success: true,
      user: {
        id: useMongoDB ? user._id.toString() : user.id,
        email: user.email,
        name: user.name,
        emailVerified: true
      }
    });

  } catch (error) {
    console.error('Set password error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
