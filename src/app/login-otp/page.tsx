"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, CheckCircle, ArrowLeft, LogIn } from 'lucide-react';

type Step = 'email' | 'otp' | 'success';

export default function LoginOTPPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState<number | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Check if email is provided in URL parameters
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      setStep('otp'); // Skip email step if email is provided
      setOtpExpiry(Date.now() + 5 * 60 * 1000); // 5 minutes
    }
  }, [searchParams]);

  const handleSendOTP = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email Required',
        description: 'Please enter your email address.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (result.success) {
        setStep('otp');
        setOtpExpiry(Date.now() + 5 * 60 * 1000); // 5 minutes
        toast({
          title: 'OTP Sent',
          description: 'Please check your email for the 6-digit OTP code. (Check console for development mode)',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Send OTP',
          description: result.message || 'Please try again.',
        });
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send OTP. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        variant: 'destructive',
        title: 'Invalid OTP',
        description: 'Please enter a valid 6-digit OTP code.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const result = await response.json();

      if (result.success) {
        // Store tokens in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', result.accessToken);
          localStorage.setItem('refreshToken', result.refreshToken);
        }
        
        setStep('success');
        toast({
          title: 'Login Successful',
          description: 'Welcome back!',
        });
        
        // Redirect to dashboard after successful login
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        toast({
          variant: 'destructive',
          title: 'Invalid OTP',
          description: result.message || 'Please check your OTP and try again.',
        });
      }
    } catch (error) {
      console.error('Login OTP error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to login. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setOtp('');
    setOtpExpiry(null);
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const remaining = Math.max(0, timestamp - now);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {step === 'email' && <Mail className="h-12 w-12 text-blue-500" />}
            {step === 'otp' && <CheckCircle className="h-12 w-12 text-green-500" />}
            {step === 'success' && <LogIn className="h-12 w-12 text-green-500" />}
          </div>
          {/* Debug step indicator */}
          <div className="text-xs text-gray-500 mb-2">Current Step: {step}</div>
          <CardTitle className="text-2xl">
            {step === 'email' && 'Sign In'}
            {step === 'otp' && 'Verify OTP'}
            {step === 'success' && 'Welcome Back!'}
          </CardTitle>
          <CardDescription>
            {step === 'email' && 'Enter your email to receive a login code'}
            {step === 'otp' && 'Enter the 6-digit code sent to your email'}
            {step === 'success' && 'You have been logged in successfully'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {step === 'email' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleSendOTP} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Sending OTP...' : 'Send Login Code'}
              </Button>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Button 
                    variant="link" 
                    className="p-0 h-auto"
                    onClick={() => router.push('/register-otp')}
                  >
                    Sign up here
                  </Button>
                </p>
              </div>
            </>
          )}

          {step === 'otp' && (
            <>
              {/* Development OTP Display */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <p className="text-sm font-medium text-yellow-800">Development Mode</p>
                </div>
                <p className="text-xs text-yellow-700">
                  OTP has been logged to the server console. Check your terminal/console for the 6-digit code.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
                {otpExpiry && (
                  <p className="text-sm text-muted-foreground text-center">
                    Code expires in: {formatTime(otpExpiry)}
                  </p>
                )}
              </div>
              <Button 
                onClick={handleVerifyOTP} 
                className="w-full"
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? 'Verifying...' : 'Sign In'}
              </Button>
              <Button 
                onClick={handleBackToEmail} 
                variant="outline" 
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Email
              </Button>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  You have been successfully logged in! Redirecting to dashboard...
                </p>
                <Button 
                  onClick={() => router.push('/')} 
                  className="w-full"
                >
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
