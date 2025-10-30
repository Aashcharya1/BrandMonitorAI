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
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    try {
      // Try to connect to MongoDB, fallback to in-memory storage
      let useMongoDB = true;
      try {
        await connectDB();
      } catch (error) {
        console.warn('MongoDB not available, using in-memory storage:', error);
        useMongoDB = false;
      }

      // Find user
      let user;
      if (useMongoDB) {
        user = await User.findOne({ email });
      } else {
        user = users.get(email);
      }

      console.log('Set password - User lookup:', { 
        email, 
        useMongoDB, 
        userFound: !!user,
        userEmail: user?.email 
      });

      if (!user) {
        return NextResponse.json(
          { message: 'User not found' },
          { status: 404 }
        );
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Update user with password and mark password setup as complete
      if (useMongoDB) {
        user.password = hashedPassword;
        user.needsPasswordSetup = false;
        if (name) {
          user.name = name;
        }
        await user.save();
      } else {
        user.password = hashedPassword;
        user.needsPasswordSetup = false;
        if (name) {
          user.name = name;
        }
        users.set(email, user);
      }

      console.log('Password set successfully for user:', email);
      
      return NextResponse.json(
        { 
          message: 'Password set successfully',
          user: {
            id: useMongoDB ? user._id.toString() : user.id,
            email: user.email,
            name: user.name,
            isOAuthUser: user.isOAuthUser,
            needsPasswordSetup: false
          }
        },
        { status: 200 }
      );
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { message: 'Database error occurred' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Set password error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
