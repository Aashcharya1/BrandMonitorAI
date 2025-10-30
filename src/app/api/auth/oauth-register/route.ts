import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

// Simple in-memory storage for development fallback
declare global {
  var __users: Map<string, any>;
}

if (!global.__users) {
  global.__users = new Map();
}
const users = global.__users;

export async function POST(request: NextRequest) {
  try {
    console.log('OAuth register API called');
    const { email, name, password } = await request.json();
    console.log('Received data:', { email, name, hasPassword: !!password });

    if (!email || !name || !password) {
      console.log('Missing required fields:', { email: !!email, name: !!name, password: !!password });
      return NextResponse.json(
        { message: 'Email, name, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Try to connect to MongoDB, fallback to in-memory storage
    let useMongoDB = true;
    try {
      await connectDB();
      console.log('MongoDB connected successfully');
    } catch (error) {
      console.warn('MongoDB not available, using in-memory storage:', error);
      useMongoDB = false;
    }

    // Check if user already exists
    let existingUser;
    if (useMongoDB) {
      try {
        existingUser = await User.findOne({ email });
      } catch (error) {
        console.error('Error checking user in MongoDB:', error);
        // Fallback to in-memory storage
        useMongoDB = false;
        existingUser = users.get(email);
      }
    } else {
      existingUser = users.get(email);
    }

    if (existingUser && !existingUser.needsPasswordSetup) {
      return NextResponse.json(
        { message: 'User with this email already exists and is fully registered' },
        { status: 409 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    let resultUser: { id: string; email: string; name: string } | null = null;

    if (existingUser) {
      // Update existing user with password
      if (useMongoDB) {
        existingUser.password = hashedPassword;
        existingUser.name = name;
        existingUser.needsPasswordSetup = false;
        await existingUser.save();
        resultUser = {
          id: existingUser._id.toString(),
          email: existingUser.email,
          name: existingUser.name,
        };
        console.log('OAuth user updated in MongoDB:', email);
      } else {
        existingUser.password = hashedPassword;
        existingUser.name = name;
        existingUser.needsPasswordSetup = false;
        users.set(email, existingUser);
        resultUser = {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        } as any;
        console.log('OAuth user updated in memory:', email);
      }
    } else {
      // Create new user (fallback case)
      const newUser = {
        email,
        name,
        password: hashedPassword,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        refreshTokens: [],
        isOAuthUser: true,
        needsPasswordSetup: false,
        oauthProvider: 'oauth',
      };

      if (useMongoDB) {
        try {
          const mongoUser = new User(newUser);
          await mongoUser.save();
          resultUser = {
            id: mongoUser._id.toString(),
            email: mongoUser.email,
            name: mongoUser.name,
          };
          console.log('New OAuth user created in MongoDB:', email);
        } catch (error) {
          console.error('Error saving to MongoDB, falling back to in-memory:', error);
          // Fallback to in-memory storage
          (newUser as any).id = Date.now().toString();
          users.set(email, newUser);
          resultUser = {
            id: (newUser as any).id,
            email: newUser.email,
            name: newUser.name,
          };
          console.log('New OAuth user created in memory (fallback):', email);
        }
      } else {
        (newUser as any).id = Date.now().toString();
        users.set(email, newUser);
        resultUser = {
          id: (newUser as any).id,
          email: newUser.email,
          name: newUser.name,
        };
        console.log('New OAuth user created in memory:', email);
      }
    }

    return NextResponse.json(
      { 
        message: 'User created successfully',
        user: resultUser
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('OAuth register error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
