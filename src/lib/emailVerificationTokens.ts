import crypto from 'crypto';

export interface VerificationToken {
  token: string;
  email: string;
  expiresAt: Date;
  userId?: string;
  used: boolean;
}

// In-memory storage for verification tokens (in production, use a database)
const verificationTokens = new Map<string, VerificationToken>();

export const generateVerificationToken = (email: string, userId?: string): string => {
  // Generate a secure random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Set expiration to 24 hours from now
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  // Store the token
  const verificationToken: VerificationToken = {
    token,
    email,
    expiresAt,
    userId,
    used: false
  };
  
  verificationTokens.set(token, verificationToken);
  
  // Clean up expired tokens
  cleanupExpiredTokens();
  
  return token;
};

export const verifyToken = (token: string): { valid: boolean; email?: string; userId?: string; error?: string } => {
  const verificationToken = verificationTokens.get(token);
  
  if (!verificationToken) {
    return { valid: false, error: 'Invalid verification token' };
  }
  
  if (verificationToken.used) {
    return { valid: false, error: 'Verification token has already been used' };
  }
  
  if (verificationToken.expiresAt < new Date()) {
    return { valid: false, error: 'Verification token has expired' };
  }
  
  return {
    valid: true,
    email: verificationToken.email,
    userId: verificationToken.userId
  };
};

export const markTokenAsUsed = (token: string): boolean => {
  const verificationToken = verificationTokens.get(token);
  
  if (!verificationToken) {
    return false;
  }
  
  verificationToken.used = true;
  verificationTokens.set(token, verificationToken);
  
  return true;
};

const cleanupExpiredTokens = () => {
  const now = new Date();
  for (const [token, verificationToken] of verificationTokens.entries()) {
    if (verificationToken.expiresAt < now) {
      verificationTokens.delete(token);
    }
  }
};

export const getVerificationUrl = (token: string, baseUrl: string = 'http://localhost:9002'): string => {
  return `${baseUrl}/verify-email?token=${token}`;
};
