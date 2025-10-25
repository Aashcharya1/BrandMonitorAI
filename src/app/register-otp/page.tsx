"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, CheckCircle, ArrowLeft } from 'lucide-react';

type Step = 'email' | 'otp' | 'password' | 'success';

export default function RegisterOTPPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState<number | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Check if email is provided in URL parameters
  useEffect(() => {
    const emailParam = searchParams.get('email');
    console.log('URL params:', searchParams.toString());
    console.log('Email param:', emailParam);
    if (emailParam) {
      setEmail(emailParam);
      setStep('otp'); // Skip email step if email is provided
      setOtpExpiry(Date.now() + 5 * 60 * 1000); // 5 minutes
      console.log('Email from URL, setting step to OTP:', emailParam);
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
        body: JSON.stringify({ email, name })
      });

      const result = await response.json();

      if (result.success) {
        console.log('OTP sent successfully, setting step to OTP');
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
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const result = await response.json();

      if (result.success) {
        setStep('password');
        toast({
          title: 'OTP Verified',
          description: 'Please set your password to complete registration.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Invalid OTP',
          description: result.message || 'Please check your OTP and try again.',
        });
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to verify OTP. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!password || !confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Password Required',
        description: 'Please enter and confirm your password.',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords Don\'t Match',
        description: 'Please make sure both passwords are the same.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters long.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword })
      });

      const result = await response.json();

      if (result.success) {
        setStep('success');
        toast({
          title: 'Registration Complete',
          description: 'Your account has been created successfully!',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Set Password',
          description: result.message || 'Please try again.',
        });
      }
    } catch (error) {
      console.error('Set password error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to set password. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  const handleGoToLogin = () => {
    router.push('/login');
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
            {step === 'password' && <Lock className="h-12 w-12 text-purple-500" />}
            {step === 'success' && <CheckCircle className="h-12 w-12 text-green-500" />}
          </div>
          {/* Debug step indicator */}
          <div className="text-xs text-gray-500 mb-2">
            Current Step: {step} | Email: {email || 'None'}
          </div>
          <CardTitle className="text-2xl">
            {step === 'email' && 'Create Account'}
            {step === 'otp' && 'Verify Email'}
            {step === 'password' && 'Set Password'}
            {step === 'success' && 'Welcome!'}
          </CardTitle>
          <CardDescription>
            {step === 'email' && 'Enter your email to get started'}
            {step === 'otp' && 'Enter the 6-digit code sent to your email'}
            {step === 'password' && 'Create a secure password for your account'}
            {step === 'success' && 'Your account has been created successfully'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {step === 'email' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Name (Optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
                {isLoading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
              
              {/* Debug: Manual step transition button */}
              <Button 
                onClick={() => {
                  console.log('Manually setting step to OTP');
                  setStep('otp');
                  setOtpExpiry(Date.now() + 5 * 60 * 1000);
                }}
                variant="outline"
                className="w-full"
              >
                🔧 Debug: Go to OTP Step
              </Button>
              
              {/* Show current state */}
              <div className="text-xs text-gray-400 text-center">
                Debug: Step={step}, Email={email || 'empty'}
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Button 
                    variant="link" 
                    className="p-0 h-auto"
                    onClick={() => router.push('/login-otp')}
                  >
                    Sign in here
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
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </Button>
              <Button 
                onClick={() => setStep('email')} 
                variant="outline" 
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Email
              </Button>
            </>
          )}

          {step === 'password' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleSetPassword} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Setting Password...' : 'Complete Registration'}
              </Button>
              <Button 
                onClick={() => setStep('otp')} 
                variant="outline" 
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to OTP
              </Button>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Your account has been created successfully! You can now log in with your email and password.
                </p>
                <Button 
                  onClick={handleGoToLogin} 
                  className="w-full"
                >
                  Go to Login
                </Button>
                <Button 
                  onClick={handleBackToLogin} 
                  variant="outline" 
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
