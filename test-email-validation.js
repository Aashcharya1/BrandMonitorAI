// Test script to verify email validation
const testEmailValidation = async () => {
  console.log('🧪 Testing Email Validation...');
  
  const testCases = [
    // Valid emails
    { email: 'user@example.com', shouldPass: true, description: 'Valid email' },
    { email: 'test@gmail.com', shouldPass: true, description: 'Valid Gmail' },
    { email: 'admin@company.org', shouldPass: true, description: 'Valid company email' },
    
    // Invalid emails
    { email: 'invalid-email', shouldPass: false, description: 'Missing @ and domain' },
    { email: 'user@', shouldPass: false, description: 'Missing domain' },
    { email: '@example.com', shouldPass: false, description: 'Missing username' },
    { email: 'user@.com', shouldPass: false, description: 'Invalid domain' },
    { email: 'user.example.com', shouldPass: false, description: 'Missing @ symbol' },
    { email: '', shouldPass: false, description: 'Empty email' },
    { email: 'user@', shouldPass: false, description: 'Incomplete email' },
  ];
  console.log('\n📧 Testing Email Format Validation:');
  for (const testCase of testCases) {
    try {
      const response = await fetch('http://localhost:9002/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testCase.email,
          password: 'password123'
        })
      });
      
      const result = await response.json();
      
      if (testCase.shouldPass) {
        // Valid email should either succeed or fail with "Invalid email or password" (not format error)
        if (response.status === 400 && result.message.includes('valid email address')) {
          console.log(`❌ ${testCase.description}: ${testCase.email} - Unexpected format error`);
        } else {
          console.log(`✅ ${testCase.description}: ${testCase.email} - Format accepted`);
        }
      } else {
        // Invalid email should fail with format error
        if (response.status === 400 && result.message.includes('valid email address')) {
          console.log(`✅ ${testCase.description}: ${testCase.email} - Correctly rejected`);
        } else {
          console.log(`❌ ${testCase.description}: ${testCase.email} - Should have been rejected`);
        }
      }
    } catch (error) {
      console.log(`❌ ${testCase.description}: ${testCase.email} - Request failed: ${error.message}`);
    }
  }
  
  console.log('\n📧 Testing Registration Email Validation:');
  
  for (const testCase of testCases.slice(0, 3)) { // Test a few cases for registration
    try {
      const response = await fetch('http://localhost:9002/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testCase.email,
          password: 'password123',
          name: 'Test User'
        })
      });
      
      const result = await response.json();
      
      if (testCase.shouldPass) {
        if (response.status === 400 && result.message.includes('valid email address')) {
          console.log(`❌ Registration ${testCase.description}: ${testCase.email} - Unexpected format error`);
        } else {
          console.log(`✅ Registration ${testCase.description}: ${testCase.email} - Format accepted`);
        }
      } else {
        if (response.status === 400 && result.message.includes('valid email address')) {
          console.log(`✅ Registration ${testCase.description}: ${testCase.email} - Correctly rejected`);
        } else {
          console.log(`❌ Registration ${testCase.description}: ${testCase.email} - Should have been rejected`);
        }
      }
    } catch (error) {
      console.log(`❌ Registration ${testCase.description}: ${testCase.email} - Request failed: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Email validation tests completed!');
  console.log('\n📝 Expected Behavior:');
  console.log('- Valid emails: Should be accepted (format-wise)');
  console.log('- Invalid emails: Should show "Please enter a valid email address"');
  console.log('- Real-time validation: Red border and error text under input field');
};

// Run the test
testEmailValidation();
