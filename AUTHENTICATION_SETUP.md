# JWT Authentication Setup for BrandMonitorAI

This document explains how to set up JWT authentication with MongoDB for the BrandMonitorAI application.

## Prerequisites

1. **MongoDB**: Make sure you have MongoDB running locally or have access to a MongoDB instance
2. **Node.js**: Version 18 or higher
3. **npm**: Package manager

## Setup Instructions

### 1. Install Dependencies

The required dependencies have already been installed:
- `jsonwebtoken`: For JWT token generation and verification
- `bcryptjs`: For password hashing
- `mongoose`: For MongoDB connection and modeling
- `@types/jsonwebtoken` and `@types/bcryptjs`: TypeScript type definitions

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/brandmonitorai

# JWT Secrets (Change these in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-this-in-production

# Next.js
NEXTAUTH_URL=http://localhost:9002
```

### 3. MongoDB Setup

Make sure MongoDB is running on your system. The default connection string points to `mongodb://localhost:27017/brandmonitorai`.

If you're using MongoDB Atlas or a different MongoDB instance, update the `MONGODB_URI` in your `.env.local` file.

### 4. Start the Application

```bash
npm run dev
```

The application will start on `http://localhost:9002`.

## Authentication Flow

### Registration
1. User fills out the registration form with email, password, and optional name
2. Password is hashed using bcryptjs
3. User is created in MongoDB
4. JWT access token (15 minutes) and refresh token (7 days) are generated
5. Tokens are stored in localStorage
6. User is redirected to the dashboard

### Login
1. User enters email and password
2. Password is verified against the hashed password in the database
3. JWT tokens are generated and stored
4. User is redirected to the dashboard

### Token Management
- **Access Token**: Short-lived (15 minutes) for API authentication
- **Refresh Token**: Long-lived (7 days) for getting new access tokens
- Tokens are automatically refreshed when the access token expires
- If refresh fails, user is logged out

### Logout
- Tokens are removed from localStorage
- User is redirected to the login page

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/verify` - Verify access token
- `GET /api/auth/me` - Get current user info

## Security Features

1. **Password Hashing**: Passwords are hashed using bcryptjs with salt rounds of 12
2. **JWT Tokens**: Secure token-based authentication
3. **Token Refresh**: Automatic token refresh to maintain session
4. **Input Validation**: Server-side validation for all inputs
5. **Error Handling**: Comprehensive error handling and user feedback

## File Structure

```
src/
├── context/
│   └── AuthContext.tsx          # Authentication context and hooks
├── lib/
│   ├── mongodb.ts               # MongoDB connection
│   └── jwt.ts                   # JWT utilities
├── models/
│   └── User.ts                  # User model for MongoDB
├── app/
│   ├── api/auth/                # Authentication API routes
│   │   ├── login/route.ts
│   │   ├── register/route.ts
│   │   ├── refresh/route.ts
│   │   ├── verify/route.ts
│   │   └── me/route.ts
│   └── login/
│       └── page.tsx             # Login/Register page
└── components/
    └── layout/
        ├── AppLayout.tsx        # Main layout with auth
        └── NavMenu.tsx          # Navigation menu
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**: Make sure MongoDB is running and the connection string is correct
2. **JWT Secret Error**: Ensure JWT secrets are set in environment variables
3. **Token Expired**: The app will automatically try to refresh tokens
4. **CORS Issues**: Make sure the frontend and backend are on the same domain or CORS is properly configured

### Development Tips

1. Use strong, unique JWT secrets in production
2. Consider using environment-specific MongoDB databases
3. Implement rate limiting for authentication endpoints
4. Add email verification for user registration
5. Consider implementing password reset functionality

## Production Considerations

1. **Environment Variables**: Use strong, unique secrets for JWT
2. **MongoDB**: Use a production MongoDB instance (Atlas, etc.)
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Implement rate limiting for auth endpoints
5. **Monitoring**: Add logging and monitoring for authentication events
6. **Backup**: Regular database backups
7. **Security Headers**: Implement proper security headers
