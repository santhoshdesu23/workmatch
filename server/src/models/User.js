import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      maxlength: [30, 'First name cannot exceed 30 characters']
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [30, 'Last name cannot exceed 30 characters']
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required']
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      index: true
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'pending', 'deleted'],
      default: 'active',
      index: true
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified'
    },
    emailVerificationToken: {
      type: String,
      index: true
    },
    emailVerificationExpires: {
      type: Date
    },
    lastLogin: {
      type: Date
    },
    resetPasswordToken: {
      type: String,
      index: true
    },
    resetPasswordExpires: {
      type: Date
    },
    passwordChangedAt: {
      type: Date
    },
    tokenVersion: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('validate', function (next) {
  // If firstName or lastName are provided, trim and synchronize name
  if (this.firstName || this.lastName) {
    const first = (this.firstName || '').trim();
    const last = (this.lastName || '').trim();
    this.firstName = first;
    this.lastName = last;
    if (!this.name || this.isModified('firstName') || this.isModified('lastName')) {
      this.name = [first, last].filter(Boolean).join(' ');
    }
  } else if (this.name) {
    // If only legacy full name is provided, derive firstName and lastName
    const trimmed = this.name.trim();
    this.name = trimmed;
    const parts = trimmed.split(/\s+/);
    if (!this.firstName) {
      this.firstName = parts[0]?.slice(0, 30) || '';
    }
    if (!this.lastName) {
      this.lastName = parts.slice(1).join(' ')?.slice(0, 30) || parts[0]?.slice(0, 30) || '';
    }
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
