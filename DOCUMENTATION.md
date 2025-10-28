# 🚀 BrandMonitorAI - Complete Documentation

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Authentication System](#authentication-system)
3. [OAuth Setup](#oauth-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [API Endpoints](#api-endpoints)
7. [Frontend Components](#frontend-components)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB (local)
- Google OAuth credentials (optional)
- GitHub OAuth credentials (optional)

### Installation
```bash
# Clone and install dependencies
git clone <your-repo>
cd BrandMonitorAI
npm install

# Set up environment variables
cp env.example .env.local
# Edit .env.local with your credentials

# Start development server
npm run dev
```

### Access the Application
- **URL**: http://localhost:9002
- **Login**: Use email/password or OAuth
- **Register**: Create account with name, email, password

## 🔐 Authentication System

### Features
- ✅ **Email/Password Authentication** with JWT tokens
- ✅ **Google OAuth** integration
- ✅ **GitHub OAuth** integration
- ✅ **MongoDB** with in-memory fallback
- ✅ **Session Management** with NextAuth.js
- ✅ **Email Validation** frontend and backend
- ✅ **Password Security** with bcrypt hashing

### Authentication Flow

#### Email/Password Registration
1. User enters **name** (required), email, password
2. Backend validates and hashes password
3. User stored in MongoDB/memory
4. JWT tokens generated
5. User redirected to dashboard

#### Email/Password Login
1. User enters email and password
2. Backend verifies credentials
3. JWT tokens generated
4. User redirected to dashboard

#### OAuth Flow (Google/GitHub)
1. User clicks OAuth button
2. Redirected to provider (Google/GitHub)
3. User authorizes application
4. Provider returns to callback URL
5. NextAuth creates session
6. User data stored/updated in database
7. User redirected to dashboard

## 🔑 OAuth Setup

### Google OAuth Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create new project or select existing

2. **Enable APIs**
   - Go to "APIs & Services" > "Library"
   - Search and enable "Google+ API"

3. **Create OAuth Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: "BrandMonitorAI"

4. **Configure Redirect URIs**
   ```
   Authorized JavaScript origins:
   http://localhost:9002
   https://yourdomain.com

   Authorized redirect URIs:
   http://localhost:9002/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/google
   ```

5. **Copy Credentials**
   - Copy Client ID and Client Secret
   - Add to `.env.local`:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

### GitHub OAuth Setup

1. **Go to GitHub Developer Settings**
   - Visit: https://github.com/settings/developers
   - Click "New OAuth App"

2. **Configure Application**
   ```
   Application name: BrandMonitorAI
   Homepage URL: http://localhost:9002
   Authorization callback URL: http://localhost:9002/api/auth/callback/github
   ```

3. **Copy Credentials**
   - Copy Client ID and Client Secret
   - Add to `.env.local`:
   ```env
   GITHUB_CLIENT_ID=your-github-client-id
   GITHUB_CLIENT_SECRET=your-github-client-secret
   ```

## ⚙️ Environment Configuration

### Required Environment Variables
```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/brandmonitorai

# JWT Secrets (Change in production!)
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-jwt-refresh-secret-key

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:9002
NEXTAUTH_SECRET=your-nextauth-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Production Environment
```env
# Production URLs
NEXTAUTH_URL=https://yourdomain.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/brandmonitorai

# Generate secure secrets
JWT_SECRET=<64-character-random-string>
JWT_REFRESH_SECRET=<64-character-random-string>
NEXTAUTH_SECRET=<64-character-random-string>
```

## 🗄️ Database Setup

### MongoDB Atlas (Recommended)
1. **Create Account**: https://www.mongodb.com/atlas
2. **Create Cluster**: Choose free tier
3. **Create Database User**: Set username/password
4. **Whitelist IP**: Add your IP or 0.0.0.0/0 for development
5. **Get Connection String**: Copy and add to `.env.local`

### Local MongoDB
```bash
# Install MongoDB locally
# macOS
brew install mongodb-community

# Ubuntu
sudo apt install mongodb

# Start MongoDB
mongod --dbpath /path/to/data/directory
```

### Database Schema
```javascript
// User Model
{
  email: String (required, unique),
  password: String (required for email/password users),
  name: String (required),
  emailVerified: Boolean (default: false),
  emailVerifiedAt: Date,
  refreshTokens: [String],
  createdAt: Date,
  updatedAt: Date
}
```

## 🔌 API Endpoints

### Authentication Endpoints

#### POST `/api/auth/register`
Register new user with email/password
```json
{
  "name": "John Doe",
  "email": "john@example.com", 
  "password": "password123"
}
```

#### POST `/api/auth/login`
Login with email/password
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

#### NextAuth Endpoints
- `GET/POST /api/auth/[...nextauth]` - NextAuth handler
- `GET /api/auth/session` - Get current session
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/callback/google` - Google OAuth callback
- `GET /api/auth/callback/github` - GitHub OAuth callback

### Other Endpoints
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/verify` - Verify JWT token
- `GET /api/auth/me` - Get current user

## 🎨 Frontend Components

### Pages
- `/login` - Login page with email/password and OAuth
- `/register` - Registration page with name, email, password and OAuth
- `/` - Main dashboard (protected)
- `/dashboard` - Dashboard page (protected)

### Key Components
- `AuthProvider` - Authentication context provider
- `NextAuthProvider` - NextAuth session provider
- `AppLayout` - Main layout with sidebar
- `NavMenu` - Navigation menu
- `ClientAuthProvider` - Client-side auth wrapper

### Authentication State
```typescript
interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}
```

## 🚀 Deployment

### Vercel Deployment
1. **Connect Repository**: Link GitHub repo to Vercel
2. **Environment Variables**: Add all env vars in Vercel dashboard
3. **Update OAuth URLs**: Update callback URLs to production domain
4. **Deploy**: Automatic deployment on git push

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables for Production
- Update `NEXTAUTH_URL` to production domain
- Use MongoDB Atlas for database
- Generate secure secrets for JWT and NextAuth
- Update OAuth callback URLs

## 🔧 Troubleshooting

### Common Issues

#### OAuth Not Working
- Check OAuth credentials in `.env.local`
- Verify callback URLs match exactly
- Ensure OAuth apps are configured correctly
- Check browser console for errors

#### Database Connection Issues
- Verify MongoDB URI is correct
- Check network connectivity
- Ensure database user has proper permissions
- Check MongoDB Atlas IP whitelist

#### JWT Token Issues
- Verify JWT secrets are set
- Check token expiration times
- Clear localStorage and cookies
- Restart development server

#### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for TypeScript errors
- Verify all imports are correct

### Development Tips
- Use browser dev tools to inspect network requests
- Check server console for error logs
- Use MongoDB Compass to inspect database
- Test OAuth in incognito mode to avoid cached sessions

### Performance Optimization
- Enable MongoDB connection pooling
- Implement proper caching strategies
- Use CDN for static assets
- Optimize bundle size with tree shaking
- Implement proper error boundaries

## 📊 Scalability Features

### Built for Scale
- **JWT Authentication**: Stateless, horizontally scalable
- **MongoDB**: Handles millions of users with proper indexing
- **NextAuth.js**: Production-ready OAuth implementation
- **Connection Pooling**: Efficient database connections
- **In-Memory Fallback**: Graceful degradation
- **Modular Architecture**: Easy to extend and maintain

### Production Considerations
- Implement rate limiting
- Add proper logging and monitoring
- Use Redis for session storage
- Implement database sharding if needed
- Add load balancing
- Use environment-specific configurations

---

## 🎯 What's Working Now

✅ **Complete Authentication System**
- Email/password registration and login
- Google OAuth integration
- GitHub OAuth integration
- JWT token management
- Session handling with NextAuth.js

✅ **Database Integration**
- MongoDB with Mongoose ODM
- In-memory fallback for development
- User model with proper validation
- Connection pooling and error handling

✅ **Frontend Features**
- Beautiful login/register forms
- OAuth buttons with real functionality
- Protected routes and navigation
- User profile display with initials
- Responsive design

✅ **Security Features**
- Password hashing with bcrypt
- Email validation (frontend + backend)
- JWT token security
- CSRF protection via NextAuth
- Secure session management

✅ **Developer Experience**
- TypeScript throughout
- Comprehensive error handling
- Development and production configs
- Easy environment setup
- Detailed documentation

The application is now ready for production deployment and can scale to millions of users with proper infrastructure setup!
