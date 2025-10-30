import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
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

const SECRET = process.env.NEXTAUTH_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Read the NextAuth JWT to get the authenticated user's info
    const token = await getToken({ req: request as any, secret: SECRET });

    if (!token?.email) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const email = token.email as string;
    const name = (token.name as string) || '';

    // Try to connect to MongoDB, fallback to in-memory storage
    let useMongoDB = true;
    try {
      await connectDB();
      console.log('MongoDB connected successfully for OAuth callback');
    } catch (error) {
      console.warn('MongoDB not available, using in-memory storage:', error);
      useMongoDB = false;
    }

    // Check if user exists - always try MongoDB first
    let existingUser;
    if (useMongoDB) {
      try {
        existingUser = await User.findOne({ email });
        if (existingUser) {
          // Sync with in-memory storage
          users.set(email, {
            id: existingUser._id.toString(),
            email: existingUser.email,
            name: existingUser.name,
            isOAuthUser: existingUser.isOAuthUser,
            needsPasswordSetup: existingUser.needsPasswordSetup,
            oauthProvider: existingUser.oauthProvider
          });
          console.log('OAuth callback - User synced from MongoDB to memory:', email);
        }
      } catch (error) {
        console.error('Error checking user in MongoDB, falling back to in-memory:', error);
        useMongoDB = false;
        existingUser = users.get(email);
      }
    } else {
      existingUser = users.get(email);
    }

    if (existingUser) {
      console.log('User found:', {
        email: existingUser.email,
        needsPasswordSetup: existingUser.needsPasswordSetup,
        isOAuthUser: existingUser.isOAuthUser
      });
      
      if (existingUser.needsPasswordSetup) {
        // User exists but needs password setup, redirect to register page
        console.log('OAuth user needs password setup, redirecting to /register');
        const registerUrl = new URL('/register', request.url);
        registerUrl.searchParams.set('email', email);
        registerUrl.searchParams.set('name', name);
        registerUrl.searchParams.set('oauth', 'true');
        return NextResponse.redirect(registerUrl);
      } else {
        // User exists and password is set, redirect to localhost:9002
        console.log('OAuth user ready, redirecting to localhost:9002');
        return NextResponse.redirect('http://localhost:9002/');
      }
    } else {
      // This shouldn't happen now since we create temp users in signIn callback
      console.log('No user found, redirecting to /register');
      const registerUrl = new URL('/register', request.url);
      registerUrl.searchParams.set('email', email);
      registerUrl.searchParams.set('name', name);
      registerUrl.searchParams.set('oauth', 'true');
      return NextResponse.redirect(registerUrl);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
