import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { verifyOTP, isOTPExpired } from '@/lib/otpUtils';
import { generateTokenPair } from '@/lib/jwt';

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

    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { message: 'Email and OTP are required' },
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
        { message: 'User not found. Please sign up first.' },
        { status: 404 }
      );
    }

    // Check if user has a password (registered user)
    if (!user.password) {
      return NextResponse.json(
        { message: 'Please complete your registration first.' },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    if (!user.otpExpiresAt || isOTPExpired(user.otpExpiresAt)) {
      return NextResponse.json(
        { message: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if OTP hash exists
    if (!user.otpHash) {
      return NextResponse.json(
        { message: 'No OTP found. Please request a new one.' },
        { status: 400 }
      );
    }

    // Verify OTP
    const isValidOTP = await verifyOTP(otp, user.otpHash);
    
    if (!isValidOTP) {
      return NextResponse.json(
        { message: 'Invalid OTP. Please check and try again.' },
        { status: 400 }
      );
    }

    // OTP is valid, generate tokens and login
    const tokens = generateTokenPair({
      userId: useMongoDB ? user._id.toString() : user.id,
      email: user.email,
    });

    // Store refresh token
    if (useMongoDB) {
      user.refreshTokens.push(tokens.refreshToken);
      await user.save();
    } else {
      if (!user.refreshTokens) user.refreshTokens = [];
      user.refreshTokens.push(tokens.refreshToken);
      users.set(email, user);
    }

    // Clear OTP data
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpVerified = false;
    
    if (useMongoDB) {
      await user.save();
    } else {
      users.set(email, user);
    }

    console.log('OTP login successful for:', email);

    return NextResponse.json({
      message: 'Login successful',
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: useMongoDB ? user._id.toString() : user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error('OTP login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
