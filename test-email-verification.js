// Test script to verify email existence validation
const testEmailVerification = async () => {
  console.log('🧪 Testing Email Existence Verification...');
  
  const testCases = [
    // Valid emails (should pass)
    { email: 'test@gmail.com', shouldPass: true, description: 'Valid Gmail' },
    { email: 'user@outlook.com', shouldPass: true, description: 'Valid Outlook' },
    { email: 'admin@company.com', shouldPass: true, description: 'Valid company email' },
    
    // Invalid emails (should fail)
    { email: 'nonexistent123456789@gmail.com', shouldPass: false, description: 'Non-existent Gmail' },
    { email: 'fakeemail123456789@outlook.com', shouldPass: false, description: 'Non-existent Outlook' },
    { email: 'invalid@nonexistentdomain12345.com', shouldPass: false, description: 'Non-existent domain' },
    
    // Disposable emails (should fail)
    { email: 'test@10minutemail.com', shouldPass: false, description: 'Disposable email' },
    { email: 'user@tempmail.org', shouldPass: false, description: 'Disposable email' },
    { email: 'temp@guerrillamail.com', shouldPass: false, description: 'Disposable email' },
    
    // Role-based emails (should fail)
    { email: 'admin@company.com', shouldPass: false, description: 'Role-based email' },
    { email: 'support@company.com', shouldPass: false, description: 'Role-based email' },
    { email: 'noreply@company.com', shouldPass: false, description: 'Role-based email' },
    
    // Format errors (should fail)
    { email: 'invalid-email', shouldPass: false, description: 'Invalid format' },
    { email: 'user@', shouldPass: false, description: 'Incomplete email' },
    { email: '@company.com', shouldPass: false, description: 'Missing username' },
  ];
  
  console.log('\n📧 Testing Email Verification API:');
  
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
          console.log(`✅ ${testCase.description}: ${testCase.email} - Correctly verified as valid`);
        } else {
          console.log(`❌ ${testCase.description}: ${testCase.email} - Incorrectly rejected: ${result.message}`);
        }
      } else {
        if (!result.isValid) {
          console.log(`✅ ${testCase.description}: ${testCase.email} - Correctly rejected: ${result.message}`);
        } else {
          console.log(`❌ ${testCase.description}: ${testCase.email} - Incorrectly accepted as valid`);
        }
      }
    } catch (error) {
      console.log(`❌ ${testCase.description}: ${testCase.email} - Request failed: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Email verification tests completed!');
  console.log('\n📝 Expected Behavior:');
  console.log('- Valid emails: Should be accepted and show green checkmark');
  console.log('- Invalid emails: Should be rejected with specific error messages');
  console.log('- Disposable emails: Should be rejected with "Disposable email addresses are not allowed"');
  console.log('- Role-based emails: Should be rejected with "Role-based email addresses are not allowed"');
  console.log('- Non-existent emails: Should be rejected with "This email address does not exist"');
  console.log('- Real-time validation: Red border and error text for invalid emails');
  console.log('- Loading indicator: Spinner while verifying email existence');
};

// Run the test
testEmailVerification();
