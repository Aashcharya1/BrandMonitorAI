// Test script to verify email validation is working correctly
const testEmailFix = async () => {
  console.log('🧪 Testing Email Validation Fix...');
  
  const testCases = [
    // Valid emails (should pass)
    { email: 'test@gmail.com', shouldPass: true, description: 'Valid Gmail' },
    { email: 'user@outlook.com', shouldPass: true, description: 'Valid Outlook' },
    { email: 'name@company.com', shouldPass: true, description: 'Valid company email' },
    { email: 'student@university.edu', shouldPass: true, description: 'Valid educational email' },
    { email: 'person@yahoo.com', shouldPass: true, description: 'Valid Yahoo email' },
    
    // Invalid emails (should fail)
    { email: 'test@10minutemail.com', shouldPass: false, description: 'Disposable email' },
    { email: 'user@tempmail.org', shouldPass: false, description: 'Disposable email' },
    { email: 'temp@guerrillamail.com', shouldPass: false, description: 'Disposable email' },
    { email: 'admin@company.com', shouldPass: false, description: 'Role-based email' },
    { email: 'support@company.com', shouldPass: false, description: 'Role-based email' },
    { email: 'noreply@company.com', shouldPass: false, description: 'Role-based email' },
    
    // Format errors (should fail)
    { email: 'invalid-email', shouldPass: false, description: 'Invalid format' },
    { email: 'user@', shouldPass: false, description: 'Incomplete email' },
    { email: '@company.com', shouldPass: false, description: 'Missing username' },
  ];
  
  console.log('\n📧 Testing Email Validation:');
  
  for (const testCase of testCases) {
    try {
      const response = await fetch('http://localhost:9002/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testCase.email })
      });
      
      const result = await response.json();
      
      if (testCase.shouldPass) {
        if (result.isValid) {
          console.log(`✅ ${testCase.description}: ${testCase.email} - Correctly accepted`);
        } else {
          console.log(`❌ ${testCase.description}: ${testCase.email} - Incorrectly rejected: ${result.message}`);
        }
      } else {
        if (!result.isValid) {
          console.log(`✅ ${testCase.description}: ${testCase.email} - Correctly rejected: ${result.message}`);
        } else {
          console.log(`❌ ${testCase.description}: ${testCase.email} - Incorrectly accepted`);
        }
      }
    } catch (error) {
      console.log(`❌ ${testCase.description}: ${testCase.email} - Request failed: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Email validation tests completed!');
  console.log('\n📝 Expected Behavior:');
  console.log('- Valid emails (Gmail, Outlook, etc.): Should be accepted');
  console.log('- Disposable emails: Should be rejected');
  console.log('- Role-based emails: Should be rejected');
  console.log('- Invalid formats: Should be rejected');
  console.log('- Real-time validation: Green border for valid, red for invalid');
};

// Run the test
testEmailFix();
