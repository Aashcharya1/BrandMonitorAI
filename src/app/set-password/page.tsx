"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordInput } from '@/components/ui/password-input';
import { useToast } from '@/hooks/use-toast';
import { Lock, Shield, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SetPasswordPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isOAuthUser, setIsOAuthUser] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Get email from URL params or user context
    const email = searchParams.get('email') || user?.email;
    const oauth = searchParams.get('oauth') === 'true';
    
    if (email) {
      setUserEmail(email);
      setIsOAuthUser(oauth);
      
      // If it's an OAuth user, get name from URL params or user context
      if (oauth) {
        const userName = searchParams.get('name') || user?.name || '';
        setName(userName);
      }
    } else {
      // If no email, redirect to login
      router.push('/login');
    }
  }, [searchParams, user, router]);

  const handleSetPassword = async () => {
    if (isOAuthUser && !name) {
      toast({
        variant: 'destructive',
        title: 'Missing Name',
        description: 'Please enter your name.',
      });
      return;
    }

    if (!password || !confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'Please enter both password and confirmation.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Weak Password',
        description: 'Password must be at least 6 characters long.',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: "Passwords Don't Match",
        description: 'Please make sure both passwords are the same.',
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Setting password for email:', userEmail);
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: userEmail,
          password,
          name: isOAuthUser ? name : undefined
        }),
      });

      if (response.ok) {
        toast({
          title: 'Password Set Successfully',
          description: 'Your password has been set. Redirecting to the application...',
        });
        
        // Redirect to localhost:9002 - middleware will handle the redirect logic
        setTimeout(() => {
          window.location.href = 'http://localhost:9002/';
        }, 1000);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set password');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to set password. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Set Your Password</CardTitle>
          <CardDescription>
            Complete your account setup by setting a password for {userEmail}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOAuthUser && (
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <PasswordInput
                id="password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <PasswordInput
                id="confirmPassword"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              />
            </div>
          </div>
          
          <Button 
            onClick={handleSetPassword} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Setting password...' : 'Set Password'}
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have a password?{' '}
              <Button 
                variant="link" 
                className="p-0 h-auto"
                onClick={() => router.push('/login')}
              >
                Sign in here
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
