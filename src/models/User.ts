import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  name?: string;
  refreshTokens: string[];
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  // OTP fields
  otpHash?: string;
  otpExpiresAt?: Date;
  otpVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  name: {
    type: String,
    trim: true,
  },
  refreshTokens: [{
    type: String,
  }],
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerifiedAt: {
    type: Date,
  },
  // OTP fields
  otpHash: {
    type: String,
  },
  otpExpiresAt: {
    type: Date,
  },
  otpVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Index for faster email lookups
UserSchema.index({ email: 1 });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
