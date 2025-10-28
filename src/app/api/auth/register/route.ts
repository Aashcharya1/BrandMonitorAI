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

    const { email, password, name } = await request.json();

        // Validate input
        if (!email || !password || !name) {
          return NextResponse.json(
            { message: 'Name, email and password are required' },
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

        if (password.length < 6) {
          return NextResponse.json(
            { message: 'Password must be at least 6 characters long' },
            { status: 400 }
          );
        }

    // Check if user already exists
    let existingUser;
    if (useMongoDB) {
      existingUser = await User.findOne({ email });
    } else {
      existingUser = users.get(email);
    }
    
    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    let user;
    if (useMongoDB) {
      // Create user in MongoDB
      user = new User({
        email,
        password: hashedPassword,
        name,
        refreshTokens: [],
      });
      await user.save();
    } else {
      // Create user in memory
      user = {
        id: Date.now().toString(),
        email,
        password: hashedPassword,
        name,
      };
      users.set(email, user);
      console.log('User registered in memory:', email);
      debugUsers();
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

        // Send verification email
        try {
          const { generateVerificationToken, getVerificationUrl } = await import('@/lib/emailVerificationTokens');
          const { sendVerificationEmail } = await import('@/lib/emailService');
          
          const verificationToken = generateVerificationToken(user.email, useMongoDB ? user._id.toString() : user.id);
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:9002';
          const verificationUrl = getVerificationUrl(verificationToken, baseUrl);
          
          await sendVerificationEmail(user.email, user.name, verificationUrl);
          console.log('Verification email sent to:', user.email);
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
          // Don't fail registration if email sending fails
        }

        return NextResponse.json({
          message: 'User created successfully. Please check your email to verify your account.',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: useMongoDB ? user._id.toString() : user.id,
            email: user.email,
            name: user.name,
            emailVerified: false, // User needs to verify email
          },
          requiresVerification: true,
        });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
