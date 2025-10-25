import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { verifyOTP, isOTPExpired } from '@/lib/otpUtils';

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
        { message: 'User not found. Please request a new OTP.' },
        { status: 404 }
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

    // OTP is valid, mark as verified
    user.otpVerified = true;
    user.otpHash = undefined; // Clear OTP hash for security
    user.otpExpiresAt = undefined; // Clear expiration
    
    if (useMongoDB) {
      await user.save();
    } else {
      users.set(email, user);
    }

    console.log('OTP verified successfully for:', email);

    return NextResponse.json({
      message: 'OTP verified successfully. You can now set your password.',
      success: true,
      user: {
        id: useMongoDB ? user._id.toString() : user.id,
        email: user.email,
        name: user.name,
        otpVerified: true
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
