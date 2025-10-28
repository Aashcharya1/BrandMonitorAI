import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Please provide an email"],
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: [true, "Please provide a password"],
        minlength: 6,
    },
    name: {
        type: String,
        trim: true,
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    emailVerifiedAt: {
        type: Date,
    },
    refreshTokens: [{
        type: String,
    }],
}, {
    timestamps: true, // Adds createdAt and updatedAt
});

// Index for faster email lookups
userSchema.index({ email: 1 });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;