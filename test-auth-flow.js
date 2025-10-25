// Test script to verify the complete authentication flow
const testAuthFlow = async () => {
  console.log('🧪 Testing Complete Authentication Flow...');
  
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  };
  
  try {
    // Step 1: Test Registration
    console.log('\n1. Testing Registration...');
    const registerResponse = await fetch('http://localhost:9002/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    if (registerResponse.ok) {
      const registerData = await registerResponse.json();
      console.log('✅ Registration successful:', registerData.message);
      console.log('📧 User email:', registerData.user.email);
    } else {
      const error = await registerResponse.json();
      console.log('❌ Registration failed:', error.message);
      return;
    }
    
    // Wait a moment for the user to be stored
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Test Login with correct credentials
    console.log('\n2. Testing Login with correct credentials...');
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
      console.log('🎉 Authentication flow is working!');
    } else {
      const error = await loginResponse.json();
      console.log('❌ Login failed:', error.message);
    }
    
    // Step 3: Test Login with wrong password
    console.log('\n3. Testing Login with wrong password...');
    const wrongLoginResponse = await fetch('http://localhost:9002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'wrongpassword'
      })
    });
    
    if (wrongLoginResponse.ok) {
      console.log('❌ Login should have failed with wrong password');
    } else {
      const error = await wrongLoginResponse.json();
      console.log('✅ Login correctly failed:', error.message);
    }
    
    // Step 4: Test Login with non-existent email
    console.log('\n4. Testing Login with non-existent email...');
    const nonExistentLoginResponse = await fetch('http://localhost:9002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'password123'
      })
    });
    
    if (nonExistentLoginResponse.ok) {
      console.log('❌ Login should have failed with non-existent email');
    } else {
      const error = await nonExistentLoginResponse.json();
      console.log('✅ Login correctly failed:', error.message);
    }
    
    console.log('\n🎉 All authentication tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testAuthFlow();
