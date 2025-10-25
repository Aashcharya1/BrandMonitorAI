'use client';

import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

export default function TestAuthPage() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Authentication Test</h1>
      
      {user ? (
        <div>
          <p className="mb-4">✅ You are logged in as: {user.email}</p>
          <Button onClick={logout}>Logout</Button>
        </div>
      ) : (
        <div>
          <p className="mb-4">❌ You are not logged in</p>
          <Button onClick={() => window.location.href = '/login'}>
            Go to Login
          </Button>
        </div>
      )}
    </div>
  );
}
