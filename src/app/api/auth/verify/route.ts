import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/jwt';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

declare global {
  var __users: Map<string, any>;
}
if (!global.__users) {
  global.__users = new Map();
}
const users = global.__users;

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { message: 'Token is required' },
        { status: 400 }
      );
    }

    // Verify access token
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Try to enrich with user's name
    let name: string | undefined;
    try {
      let useMongoDB = true;
      try {
        await connectDB();
      } catch (err) {
        useMongoDB = false;
      }

      if (useMongoDB) {
        const dbUser = await User.findOne({ email: payload.email });
        name = dbUser?.name as string | undefined;
      } else {
        const memUser = users.get(payload.email as string);
        name = memUser?.name;
      }
    } catch (_) {
      // ignore enrichment failures
    }

    return NextResponse.json({
      user: {
        id: payload.userId,
        email: payload.email,
        name: name,
      },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
