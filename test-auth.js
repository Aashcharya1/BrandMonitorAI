// Simple test script to verify authentication
const testAuth = async () => {
  console.log('🧪 Testing Authentication System...');
  
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  };
  
  try {
    // Test Registration
    console.log('1. Testing registration...');
    const registerResponse = await fetch('http://localhost:9002/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    if (registerResponse.ok) {
      const registerData = await registerResponse.json();
      console.log('✅ Registration successful:', registerData.message);
    } else {
      const error = await registerResponse.json();
      console.log('⚠️ Registration failed:', error.message);
    }
    
    // Test Login
    console.log('2. Testing login...');
    const loginResponse = await fetch('http://localhost:9002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Login successful:', loginData.message);
      console.log('🎉 Authentication system is working!');
    } else {
      const error = await loginResponse.json();
      console.log('❌ Login failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testAuth();
