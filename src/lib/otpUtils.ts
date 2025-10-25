import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Generate a 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Hash OTP for secure storage
export const hashOTP = async (otp: string): Promise<string> => {
  return await bcrypt.hash(otp, 10);
};

// Verify OTP
export const verifyOTP = async (otp: string, hashedOTP: string): Promise<boolean> => {
  return await bcrypt.compare(otp, hashedOTP);
};

// Check if OTP is expired
export const isOTPExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};

// Generate OTP expiration time (5 minutes from now)
export const getOTPExpiration = (): Date => {
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + 5);
  return expiration;
};

// Clean up expired OTPs (utility function)
export const cleanupExpiredOTPs = (user: any): void => {
  if (user.otpExpiresAt && isOTPExpired(user.otpExpiresAt)) {
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpVerified = false;
  }
};
