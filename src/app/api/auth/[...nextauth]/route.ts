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
          // For OAuth, we'll use in-memory storage to avoid any DB connection issues
          const useMongoDB = false; // Force in-memory for now

          // Check if user exists
          let existingUser;
          if (useMongoDB) {
            existingUser = await User.findOne({ email: user.email });
          } else {
            existingUser = users.get(user.email);
          }

          if (!existingUser) {
            // Create new user for OAuth
            const newUser = {
              email: user.email,
              name: user.name || 'User',
              emailVerified: true,
              emailVerifiedAt: new Date(),
              refreshTokens: [],
              // No password for OAuth users
            };

            if (useMongoDB) {
              const mongoUser = new User(newUser);
              await mongoUser.save();
              user.id = mongoUser._id.toString();
              console.log('OAuth user created in MongoDB:', user.email);
            } else {
              newUser.id = Date.now().toString();
              users.set(user.email, newUser);
              user.id = newUser.id;
              console.log('OAuth user created in memory:', user.email);
            }
          } else {
            // Update existing user info
            if (useMongoDB) {
              existingUser.name = user.name || existingUser.name;
              existingUser.emailVerified = true;
              await existingUser.save();
              user.id = existingUser._id.toString();
              console.log('OAuth user updated in MongoDB:', user.email);
            } else {
              existingUser.name = user.name || existingUser.name;
              existingUser.emailVerified = true;
              users.set(user.email, existingUser);
              user.id = existingUser.id;
              console.log('OAuth user updated in memory:', user.email);
            }
          }

          return true;
        } catch (error) {
          console.error('OAuth sign in error:', error);
          console.error('Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            provider: account?.provider,
            userEmail: user.email
          });
          return false;
        }
      }
      console.log('Non-OAuth sign in, allowing');
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.emailVerified = user.emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.emailVerified = token.emailVerified as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    signUp: '/register',
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
