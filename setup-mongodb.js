const fs = require('fs');
const path = require('path');

console.log('🔧 MongoDB Atlas Setup Guide');
console.log('============================');
console.log('');
console.log('1. Go to https://www.mongodb.com/atlas');
console.log('2. Create a free account');
console.log('3. Create a new cluster (free tier)');
console.log('4. Get your connection string');
console.log('5. Update the .env.local file with your connection string');
console.log('');
console.log('Example connection string:');
console.log('MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/brandmonitorai?retryWrites=true&w=majority');
console.log('');
console.log('⚠️  Make sure to:');
console.log('- Replace username with your MongoDB username');
console.log('- Replace password with your MongoDB password');
console.log('- Replace cluster0 with your actual cluster name');
console.log('- Add your IP address to the whitelist in MongoDB Atlas');
console.log('');

// Create a template .env.local file
const envContent = `# MongoDB Connection (MongoDB Atlas - Cloud)
# Replace with your actual MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/brandmonitorai?retryWrites=true&w=majority

# JWT Secrets (Change these in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-this-in-production

# Next.js
NEXTAUTH_URL=http://localhost:9002
`;

const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local template file');
  console.log('📝 Please update MONGODB_URI with your MongoDB Atlas connection string');
} else {
  console.log('⚠️  .env.local already exists');
  console.log('📝 Please update MONGODB_URI with your MongoDB Atlas connection string');
}
