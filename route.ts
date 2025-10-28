import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { email, password, confirmPassword } = await request.json();

    if (!email || !password || !confirmPassword) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ message: 'Passwords do not match' }, { status: 400 });
    }

    if (password.length < 6) {
        return NextResponse.json({ message: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ message: 'User not found. Please start the sign-up process again.' }, { status: 404 });
    }

    if (!user.otpVerified) {
      return NextResponse.json({ message: 'OTP not verified. Please verify your OTP first.' }, { status: 403 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Finalize user creation
    user.password = hashedPassword;
    user.otpHash = undefined; // Clear OTP data
    user.otpExpiresAt = undefined;
    await user.save();

    return NextResponse.json({ message: 'Account created successfully. You can now log in.' }, { status: 201 });

  } catch (error) {
    console.error('Set Password Error:', error);
    return NextResponse.json({ message: 'An internal server error occurred' }, { status: 500 });
  }
}