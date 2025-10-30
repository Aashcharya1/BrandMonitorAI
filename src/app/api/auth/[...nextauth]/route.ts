import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import CredentialsProvider from 'next-auth/providers/credentials'
import { JWT } from 'next-auth/jwt'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { generateTokenPair } from '@/lib/jwt'

// Simple in-memory storage for development fallback
declare global {
  var __users: Map<string, any>;
}

if (!global.__users) {
  global.__users = new Map();
}
const users = global.__users;

// Log OAuth configuration
console.log('OAuth Config Check:', {
  hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  hasGithubClientId: !!process.env.GITHUB_CLIENT_ID,
  hasGithubClientSecret: !!process.env.GITHUB_CLIENT_SECRET,
  hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
  hasNextAuthUrl: !!process.env.NEXTAUTH_URL
});

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Try to connect to MongoDB, fallback to in-memory storage
          let useMongoDB = true;
          try {
            await connectDB();
          } catch (error) {
            console.warn('MongoDB not available, using in-memory storage:', error);
            useMongoDB = false;
          }

          // Find user
          let user;
          if (useMongoDB) {
            user = await User.findOne({ email: credentials.email });
          } else {
            user = users.get(credentials.email);
          }

          if (!user) {
            return null;
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordValid) {
            return null;
          }

          return {
            id: useMongoDB ? user._id.toString() : user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
          }
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('signIn callback called:', { 
        provider: account?.provider, 
        userEmail: user.email,
        hasAccount: !!account 
      });

      if (account?.provider === 'google' || account?.provider === 'github') {
        // Always use in-memory storage for now to avoid DB connection issues
        console.log('OAuth sign in attempt:', { email: user.email, provider: account?.provider });

        // Validate that we have an email from OAuth provider
        if (!user.email) {
          console.error('OAuth sign in error: No email provided by OAuth provider');
          return false;
        }

        try {
          // Try to connect to MongoDB, fallback to in-memory storage
          let useMongoDB = true;
          try {
            await connectDB();
          } catch (error) {
            console.warn('MongoDB not available, using in-memory storage:', error);
            useMongoDB = false;
          }

          // Check if user exists
          let existingUser;
          if (useMongoDB) {
            existingUser = await User.findOne({ email: user.email });
          } else {
            existingUser = users.get(user.email);
          }

          if (!existingUser) {
            // For new OAuth users, create a temporary user entry
            console.log('New OAuth user detected, creating temporary entry:', user.email);
            
            const tempUser = {
              email: user.email,
              name: user.name || 'User',
              emailVerified: true,
              emailVerifiedAt: new Date(),
              refreshTokens: [],
              isOAuthUser: true,
              needsPasswordSetup: true,
              oauthProvider: account?.provider,
            };

            if (useMongoDB) {
              const mongoUser = new User(tempUser);
              await mongoUser.save();
              (user as any).id = mongoUser._id.toString();
              console.log('Temporary OAuth user created in MongoDB:', user.email);
            } else {
              (tempUser as any).id = Date.now().toString();
              users.set(user.email, tempUser);
              (user as any).id = (tempUser as any).id;
              console.log('Temporary OAuth user created in memory:', user.email);
            }
          } else {
            // Update existing user info
            if (useMongoDB) {
              existingUser.name = user.name || existingUser.name;
              existingUser.emailVerified = true;
              existingUser.oauthProvider = account?.provider;
              await existingUser.save();
              (user as any).id = existingUser._id.toString();
              console.log('OAuth user updated in MongoDB:', user.email);
            } else {
              existingUser.name = user.name || existingUser.name;
              existingUser.emailVerified = true;
              existingUser.oauthProvider = account?.provider;
              users.set(user.email, existingUser);
              (user as any).id = (existingUser as any).id;
              console.log('OAuth user updated in memory:', user.email);
            }
          }

          return true;
        } catch (error) {
          console.error('OAuth sign in error (non-blocking):', error);
          console.error('Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            provider: account?.provider,
            userEmail: user.email
          });
          // Do not block sign-in on transient errors; allow redirect to proceed
          return true;
        }
      }
      console.log('Non-OAuth sign in, allowing');
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = (user as any).id;
        token.email = user.email;
        token.name = user.name;
        token.emailVerified = (user as any).emailVerified;
        
        // Add OAuth user flags
        if (account?.provider === 'google' || account?.provider === 'github') {
          // Always check MongoDB first for OAuth users
          try {
            const mongoUser = await User.findOne({ email: user.email });
            if (mongoUser) {
              token.isOAuthUser = mongoUser.isOAuthUser;
              token.needsPasswordSetup = mongoUser.needsPasswordSetup;
              token.oauthProvider = mongoUser.oauthProvider;
              
              // Sync with in-memory storage
              const users = global.__users;
              users.set(user.email!, {
                id: mongoUser._id.toString(),
                email: mongoUser.email,
                name: mongoUser.name,
                isOAuthUser: mongoUser.isOAuthUser,
                needsPasswordSetup: mongoUser.needsPasswordSetup,
                oauthProvider: mongoUser.oauthProvider
              });
              
              console.log('JWT - OAuth user flags set from MongoDB:', {
                email: user.email,
                isOAuthUser: mongoUser.isOAuthUser,
                needsPasswordSetup: mongoUser.needsPasswordSetup
              });
            }
          } catch (error) {
            console.error('Error checking MongoDB for OAuth user in JWT:', error);
            // Fallback to in-memory storage
            const users = global.__users;
            const existingUser = users.get(user.email || '');
            if (existingUser) {
              token.isOAuthUser = existingUser.isOAuthUser;
              token.needsPasswordSetup = existingUser.needsPasswordSetup;
              token.oauthProvider = existingUser.oauthProvider;
            }
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        (session.user as any).emailVerified = token.emailVerified as boolean;
        (session.user as any).isOAuthUser = token.isOAuthUser as boolean;
        (session.user as any).needsPasswordSetup = token.needsPasswordSetup as boolean;
        (session.user as any).oauthProvider = token.oauthProvider as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // If it's a relative URL, make it absolute
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // If it's the same origin, allow it
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      // For OAuth redirects, we'll handle this in the signIn callback
      return url;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
