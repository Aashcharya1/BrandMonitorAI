import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export function generateOtp(): string {
  // Generate a 6-digit OTP
  return crypto.randomInt(100000, 999999).toString();
}

export async function hashOtp(otp: string): Promise<string> {
  // Hash the OTP with bcrypt before storing
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
}