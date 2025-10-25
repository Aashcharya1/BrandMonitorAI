// Test script to verify error messages are working
const testErrorMessages = async () => {
  console.log('🧪 Testing Error Messages...');
  
  try {
    // Test 1: Login with wrong password
    console.log('\n1. Testing login with wrong password...');
    const wrongPasswordResponse = await fetch('http://localhost:9002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'wrongpassword'
      })
    });
    
    if (wrongPasswordResponse.status === 401) {
      const error = await wrongPasswordResponse.json();
      console.log('✅ Wrong password error:', error.message);
    } else {
      console.log('❌ Expected 401 error for wrong password');
    }
    
    // Test 2: Login with non-existent email
    console.log('\n2. Testing login with non-existent email...');
    const nonExistentResponse = await fetch('http://localhost:9002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'password123'
      })
    });
    
    if (nonExistentResponse.status === 401) {
      const error = await nonExistentResponse.json();
      console.log('✅ Non-existent email error:', error.message);
    } else {
      console.log('❌ Expected 401 error for non-existent email');
    }
    
    // Test 3: Registration with existing email
    console.log('\n3. Testing registration with existing email...');
    const existingEmailResponse = await fetch('http://localhost:9002/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'aashcharyagorakh@gmail.com', // This email already exists
        password: 'password123',
        name: 'Test User'
      })
    });
    
    if (existingEmailResponse.status === 409) {
      const error = await existingEmailResponse.json();
      console.log('✅ Existing email error:', error.message);
    } else {
      console.log('❌ Expected 409 error for existing email');
    }
    
    // Test 4: Registration with missing fields
    console.log('\n4. Testing registration with missing fields...');
    const missingFieldsResponse = await fetch('http://localhost:9002/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '', // Missing email
        password: 'password123'
      })
    });
    
    if (missingFieldsResponse.status === 400) {
      const error = await missingFieldsResponse.json();
      console.log('✅ Missing fields error:', error.message);
    } else {
      console.log('❌ Expected 400 error for missing fields');
    }
    
    console.log('\n🎉 All error message tests completed!');
    console.log('\n📝 Expected Toast Messages:');
    console.log('- "You have entered wrong email or password"');
    console.log('- "An account with this email already exists"');
    console.log('- "Please enter both your email and password"');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testErrorMessages();
