// Test OAuth Integration
console.log('🧪 Testing OAuth Integration...\n');

const baseUrl = 'http://localhost:9002';

async function testNextAuthEndpoints() {
  console.log('1. Testing NextAuth Endpoints...');
  
  try {
    // Test session endpoint
    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`);
    console.log('   Session endpoint status:', sessionResponse.status);
    
    // Test providers endpoint
    const providersResponse = await fetch(`${baseUrl}/api/auth/providers`);
    console.log('   Providers endpoint status:', providersResponse.status);
    
    if (providersResponse.ok) {
      const providers = await providersResponse.json();
      console.log('   Available providers:', Object.keys(providers));
    }
    
  } catch (error) {
    console.log('   ❌ NextAuth endpoints error:', error.message);
  }
}

async function testEmailPasswordAuth() {
  console.log('\n2. Testing Email/Password Authentication...');
  
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123'
  };
  
  try {
    // Test registration
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    console.log('   Registration status:', registerResponse.status);
    
    if (registerResponse.ok) {
      console.log('   ✅ Registration successful');
    } else {
      const error = await registerResponse.json();
      console.log('   Registration response:', error.message);
    }
    
    // Test login
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    
    console.log('   Login status:', loginResponse.status);
    
    if (loginResponse.ok) {
      console.log('   ✅ Login successful');
    } else {
      const error = await loginResponse.json();
      console.log('   Login response:', error.message);
    }
    
  } catch (error) {
    console.log('   ❌ Email/Password auth error:', error.message);
  }
}

async function checkEnvironmentVariables() {
  console.log('\n3. Checking Environment Configuration...');
  
  const requiredVars = [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET'
  ];
  
  console.log('   Required environment variables:');
  requiredVars.forEach(varName => {
    const isSet = process.env[varName] && process.env[varName] !== 'your-' + varName.toLowerCase().replace(/_/g, '-') + '-here';
    console.log(`   ${isSet ? '✅' : '❌'} ${varName}: ${isSet ? 'Set' : 'Not set or using placeholder'}`);
  });
}

async function runTests() {
  console.log('🎯 OAuth Integration Test Suite\n');
  console.log('Make sure your server is running on http://localhost:9002\n');
  
  await testNextAuthEndpoints();
  await testEmailPasswordAuth();
  await checkEnvironmentVariables();
  
  console.log('\n📋 Setup Instructions:');
  console.log('1. Copy env.example to .env.local');
  console.log('2. Set up Google OAuth: https://console.cloud.google.com/');
  console.log('3. Set up GitHub OAuth: https://github.com/settings/developers');
  console.log('4. Update .env.local with your OAuth credentials');
  console.log('5. Restart your development server');
  console.log('6. Test OAuth buttons on /login and /register pages');
  
  console.log('\n🚀 OAuth URLs to configure:');
  console.log('Google callback: http://localhost:9002/api/auth/callback/google');
  console.log('GitHub callback: http://localhost:9002/api/auth/callback/github');
  
  console.log('\n✅ OAuth integration is ready!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testNextAuthEndpoints, testEmailPasswordAuth, checkEnvironmentVariables };
