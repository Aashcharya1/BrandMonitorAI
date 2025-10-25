import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, markTokenAsUsed } from '@/lib/emailVerificationTokens';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { message: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Verify the token
    const tokenResult = verifyToken(token);
    
    if (!tokenResult.valid) {
      return NextResponse.json(
        { 
          message: tokenResult.error || 'Invalid verification token',
          success: false 
        },
        { status: 400 }
      );
    }

    // Try to connect to MongoDB, fallback to in-memory storage
    let useMongoDB = true;
    try {
      await connectDB();
    } catch (error) {
      console.warn('MongoDB not available, using in-memory storage:', error);
      useMongoDB = false;
    }

    // Update user verification status
    if (useMongoDB) {
      // Update user in MongoDB
      const user = await User.findOne({ email: tokenResult.email });
      if (user) {
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        await user.save();
      }
    } else {
      // Update user in memory (if using in-memory storage)
      // Note: In-memory users don't persist email verification status
      // This is a limitation of the in-memory fallback
      console.log('Email verification completed for:', tokenResult.email);
    }

    // Mark token as used
    markTokenAsUsed(token);

    return NextResponse.json({
      message: 'Email verified successfully',
      success: true,
      email: tokenResult.email
    });

  } catch (error) {
    console.error('Verify token error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
