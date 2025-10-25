import { NextRequest, NextResponse } from 'next/server';
import { generateVerificationToken, getVerificationUrl } from '@/lib/emailVerificationTokens';
import { sendVerificationEmail } from '@/lib/emailService';

export async function POST(request: NextRequest) {
  try {
    const { email, name, userId } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Generate verification token
    const token = generateVerificationToken(email, userId);
    
    // Create verification URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:9002';
    const verificationUrl = getVerificationUrl(token, baseUrl);
    
    // Send verification email
    const emailResult = await sendVerificationEmail(email, name, verificationUrl);
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return NextResponse.json(
        { 
          message: 'Failed to send verification email. Please try again.',
          error: emailResult.error 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Verification email sent successfully',
      success: true
    });

  } catch (error) {
    console.error('Send verification email error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
