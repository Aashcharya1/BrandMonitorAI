import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { generateOTP, hashOTP, getOTPExpiration } from '@/lib/otpUtils';
import { sendOTPEmail } from '@/lib/otpEmailService';

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

    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
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

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const otpExpiresAt = getOTPExpiration();

    let user;
    if (useMongoDB) {
      // Find or create user in MongoDB
      user = await User.findOne({ email });
      if (!user) {
        user = new User({
          email,
          name,
          otpHash,
          otpExpiresAt,
          otpVerified: false,
          emailVerified: false,
          refreshTokens: []
        });
      } else {
        user.otpHash = otpHash;
        user.otpExpiresAt = otpExpiresAt;
        user.otpVerified = false;
        if (name) user.name = name;
      }
      await user.save();
    } else {
      // Find or create user in memory
      user = users.get(email);
      if (!user) {
        user = {
          id: Date.now().toString(),
          email,
          name,
          otpHash,
          otpExpiresAt,
          otpVerified: false,
          emailVerified: false,
          refreshTokens: []
        };
        users.set(email, user);
        console.log('User created in memory for OTP:', email);
      } else {
        user.otpHash = otpHash;
        user.otpExpiresAt = otpExpiresAt;
        user.otpVerified = false;
        if (name) user.name = name;
        users.set(email, user);
        console.log('User updated in memory for OTP:', email);
      }
    }

    // Send OTP email
    try {
      const emailResult = await sendOTPEmail(email, name || 'User', otp);
      
      if (!emailResult.success) {
        console.error('Failed to send OTP email:', emailResult.error);
        return NextResponse.json(
          { 
            message: 'Failed to send OTP email. Please try again.',
            error: emailResult.error 
          },
          { status: 500 }
        );
      }
      
      console.log('OTP email sent successfully to:', email);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      return NextResponse.json(
        { message: 'Failed to send OTP email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'OTP sent successfully to your email address',
      success: true,
      expiresIn: 5 * 60 * 1000 // 5 minutes in milliseconds
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
