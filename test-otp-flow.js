// Test OTP Flow
console.log('🧪 Testing OTP Flow...\n');

// Test 1: OTP Email Service
console.log('1. Testing OTP Email Service:');
const { sendOTPEmail } = require('./src/lib/otpEmailService.ts');

sendOTPEmail('test@example.com', 'Test User', '123456')
  .then(result => {
    console.log('   ✅ OTP Email Service Result:', result);
    console.log('   📧 Check server console for OTP display\n');
  })
  .catch(err => {
    console.error('   ❌ OTP Email Service Error:', err);
  });

// Test 2: API Endpoint
console.log('2. Testing Send OTP API:');
fetch('http://localhost:9002/api/auth/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', name: 'Test User' })
})
.then(response => response.json())
.then(data => {
  console.log('   ✅ API Response:', data);
  if (data.success) {
    console.log('   📧 OTP should be displayed in server console');
  } else {
    console.log('   ❌ API Error:', data.message);
  }
})
.catch(err => {
  console.error('   ❌ API Request Error:', err);
});

console.log('\n🎯 Next Steps:');
console.log('1. Start your server: npm run dev');
console.log('2. Go to http://localhost:9002/register');
console.log('3. Enter your email and click "Send Verification Code"');
console.log('4. Check server console for the OTP code');
console.log('5. Enter the OTP code in the form');
console.log('6. Complete registration with password');
