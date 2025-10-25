import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailExistence, isDisposableEmail, isRoleEmail } from '@/lib/emailVerification';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        isValid: false,
        message: 'Please enter a valid email address format',
        isDisposable: false,
        isRole: false,
        isFree: false,
        isDeliverable: false
      });
    }

    // Check for disposable emails first (fast check)
    if (isDisposableEmail(email)) {
      return NextResponse.json({
        isValid: false,
        message: 'Disposable email addresses are not allowed. Please use a permanent email address.',
        isDisposable: true,
        isRole: false,
        isFree: false,
        isDeliverable: false
      });
    }

    // Check for role-based emails
    if (isRoleEmail(email)) {
      return NextResponse.json({
        isValid: false,
        message: 'Role-based email addresses (admin, support, etc.) are not allowed. Please use a personal email address.',
        isDisposable: false,
        isRole: true,
        isFree: false,
        isDeliverable: false
      });
    }

    // Verify email existence with third-party services
    const verificationResult = await verifyEmailExistence(email);

    if (!verificationResult.isValid) {
      let message = 'This email address is not allowed.';
      
      if (verificationResult.isDisposable) {
        message = 'Disposable email addresses are not allowed. Please use a permanent email address.';
      } else if (verificationResult.isRole) {
        message = 'Role-based email addresses are not allowed. Please use a personal email address.';
      } else {
        // Only reject if we have specific verification that the email is invalid
        // Don't reject based on deliverability alone if verification services are unavailable
        message = 'This email address cannot receive emails. Please check the email address and try again.';
      }

      return NextResponse.json({
        isValid: false,
        message,
        isDisposable: verificationResult.isDisposable,
        isRole: verificationResult.isRole,
        isFree: verificationResult.isFree,
        isDeliverable: verificationResult.isDeliverable
      });
    }

    return NextResponse.json({
      isValid: true,
      message: 'Email address is valid and can receive emails',
      isDisposable: verificationResult.isDisposable,
      isRole: verificationResult.isRole,
      isFree: verificationResult.isFree,
      isDeliverable: verificationResult.isDeliverable
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { 
        message: 'Email verification service is temporarily unavailable. Please try again later.',
        isValid: true, // Default to valid on service error
        isDisposable: false,
        isRole: false,
        isFree: false,
        isDeliverable: true
      },
      { status: 500 }
    );
  }
}
