const fs = require('fs');
const path = require('path');

const envContent = `# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/brandmonitorai

# JWT Secrets (Change these in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-this-in-production

# Next.js
NEXTAUTH_URL=http://localhost:9003
`;

const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local file with default configuration');
  console.log('📝 Please update the MongoDB URI and JWT secrets as needed');
} else {
  console.log('⚠️  .env.local already exists, skipping creation');
}
