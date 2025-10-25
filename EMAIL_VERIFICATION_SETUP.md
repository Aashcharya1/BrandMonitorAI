# 📧 Email Verification System Setup Guide

## ✅ **Level 4: Email Verification via Confirmation Email Implemented!**

### **What's Been Implemented:**

1. **✅ Verification Token System**
   - Secure token generation using crypto
   - 24-hour expiration
   - One-time use tokens
   - In-memory storage (production: use database)

2. **✅ Email Service Integration**
   - EmailJS integration for sending emails
   - Beautiful HTML email templates
   - Fallback SMTP option

3. **✅ API Endpoints**
   - `/api/auth/send-verification` - Send verification emails
   - `/api/auth/verify-token` - Verify email tokens
   - Updated registration flow

4. **✅ User Interface**
   - Email verification page (`/verify-email`)
   - Success/error states
   - Resend verification option

5. **✅ Database Updates**
   - Added `emailVerified` and `emailVerifiedAt` fields
   - Updated User model

## 🚀 **How It Works:**

### **Registration Flow:**
1. User registers with email/password
2. System generates secure verification token
3. Verification email sent with unique link
4. User clicks link to verify email
5. Account is fully activated

### **Verification Process:**
1. User receives email with verification link
2. Clicks link → goes to `/verify-email?token=...`
3. System validates token (not expired, not used)
4. Updates user's `emailVerified` status
5. Shows success message

## 🔧 **Setup Instructions:**

### **1. Configure EmailJS (Recommended):**

#### **Get EmailJS Account:**
1. Go to: https://www.emailjs.com/
2. Sign up for free account
3. Create a new service (Gmail, Outlook, etc.)
4. Get your Service ID and Public Key

#### **Create Email Template:**
1. In EmailJS dashboard, go to "Email Templates"
2. Create new template with ID: `verification_template`
3. Use this template content:

```html
Subject: Verify Your BrandMonitorAI Account

Hello {{to_name}}!

Thank you for signing up with BrandMonitorAI. To complete your registration and start monitoring your brand, please verify your email address by clicking the button below:

[Verify Email Address]({{verification_url}})

If the button doesn't work, you can also copy and paste this link into your browser:
{{verification_url}}

This verification link will expire in 24 hours. If you didn't create an account with BrandMonitorAI, you can safely ignore this email.

Best regards,
The BrandMonitorAI Team
```

### **2. Add Environment Variables:**

Create or update `.env.local`:
```env
# EmailJS Configuration
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your-service-id-here
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your-public-key-here

# App URL (for verification links)
NEXTAUTH_URL=http://localhost:9002
```

### **3. Restart the Server:**
```bash
npm run dev
```

## 🧪 **Testing the Email Verification:**

### **1. Test Registration:**
1. Go to `http://localhost:9002`
2. Click "Sign Up"
3. Enter email and password
4. Click "Create Account"
5. Check your email for verification link

### **2. Test Verification:**
1. Click the verification link in your email
2. Should redirect to `/verify-email` page
3. Should show "Email Verified!" success message
4. Can now login with verified account

### **3. Test Error Cases:**
- Expired token (after 24 hours)
- Already used token
- Invalid token format

## 📧 **Email Template Features:**

### **Beautiful HTML Design:**
- Gradient header with app branding
- Clear call-to-action button
- Responsive design
- Professional styling
- Expiration notice
- Fallback text link

### **Template Variables:**
- `{{to_name}}` - User's name
- `{{to_email}}` - User's email
- `{{verification_url}}` - Unique verification link
- `{{app_name}}` - BrandMonitorAI

## 🔒 **Security Features:**

### **Token Security:**
- 64-character random hex tokens
- 24-hour expiration
- One-time use only
- Secure generation using crypto

### **Email Security:**
- No sensitive data in URLs
- Tokens are not guessable
- Automatic cleanup of expired tokens
- Rate limiting (can be added)

## 🎨 **User Experience:**

### **Registration Flow:**
1. **Sign Up** → Account created
2. **Email Sent** → "Check your email" message
3. **Click Link** → Verification page
4. **Success** → "Email verified!" message
5. **Login** → Full access to dashboard

### **Error Handling:**
- **Expired Link**: "Link expired" with resend option
- **Invalid Token**: "Invalid link" with help
- **Already Used**: "Already verified" message
- **Network Error**: "Try again" with retry option

## 🚀 **Production Considerations:**

### **Database Storage:**
Replace in-memory token storage with database:
```typescript
// In production, use MongoDB or PostgreSQL
const VerificationToken = mongoose.model('VerificationToken', {
  token: String,
  email: String,
  userId: String,
  expiresAt: Date,
  used: Boolean
});
```

### **Email Service Options:**
1. **EmailJS** (Current) - Easy setup, free tier
2. **SendGrid** - Professional, more features
3. **AWS SES** - Scalable, cost-effective
4. **Nodemailer** - Custom SMTP setup

### **Rate Limiting:**
Add rate limiting to prevent abuse:
```typescript
// Limit verification emails per email address
const rateLimit = new Map();
const maxAttempts = 3;
const timeWindow = 3600000; // 1 hour
```

## 📊 **Monitoring & Analytics:**

### **Track Verification Rates:**
- Total registrations
- Emails sent successfully
- Verification completion rate
- Common failure points

### **Log Important Events:**
- Token generation
- Email sending success/failure
- Verification attempts
- Expired token usage

## 🎉 **Success Indicators:**

You'll know it's working when:
- ✅ **Registration**: Shows "Check your email" message
- ✅ **Email Received**: Beautiful verification email arrives
- ✅ **Link Works**: Clicking link shows verification page
- ✅ **Success**: "Email verified!" message appears
- ✅ **Login Works**: Can login with verified account
- ✅ **Error Handling**: Expired/invalid links show appropriate messages

## 🔧 **Troubleshooting:**

### **Email Not Received:**
1. Check spam folder
2. Verify EmailJS configuration
3. Check email service status
4. Test with different email provider

### **Verification Link Not Working:**
1. Check token expiration
2. Verify URL format
3. Check server logs
4. Test with fresh token

### **Database Issues:**
1. Check MongoDB connection
2. Verify User model updates
3. Check token storage
4. Test with in-memory fallback

**Your email verification system is now fully functional! Users must verify their email addresses before they can fully use the application.** 🚀
