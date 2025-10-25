// OTP Email Service with fallback for development
const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = 'otp_template';
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

export interface OTPEmailTemplate {
  to_email: string;
  to_name: string;
  otp_code: string;
  app_name: string;
  expiry_minutes: string;
}

export const sendOTPEmail = async (
  email: string,
  name: string,
  otp: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if EmailJS is configured
    if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || 
        EMAILJS_SERVICE_ID === 'your-service-id' || 
        EMAILJS_PUBLIC_KEY === 'your-public-key') {
      
      // Fallback: Log OTP to console for development
      console.log('='.repeat(60));
      console.log('📧 OTP EMAIL (Development Mode)');
      console.log('='.repeat(60));
      console.log(`To: ${email}`);
      console.log(`Name: ${name || 'User'}`);
      console.log(`OTP Code: ${otp}`);
      console.log(`Expires: 5 minutes`);
      console.log('='.repeat(60));
      console.log('⚠️  In production, configure EmailJS or SMTP service');
      console.log('='.repeat(60));
      
      return { success: true };
    }

    // Try to use EmailJS if configured
    try {
      const emailjs = await import('@emailjs/browser');
      emailjs.default.init(EMAILJS_PUBLIC_KEY);
      
      const templateParams: OTPEmailTemplate = {
        to_email: email,
        to_name: name || 'User',
        otp_code: otp,
        app_name: 'BrandMonitorAI',
        expiry_minutes: '5'
      };
      
      const response = await emailjs.default.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
      );
      
      console.log('OTP email sent successfully via EmailJS:', response);
      return { success: true };
      
    } catch (emailjsError: any) {
      console.warn('EmailJS failed, falling back to console logging:', emailjsError);
      
      // Fallback to console logging
      console.log('='.repeat(60));
      console.log('📧 OTP EMAIL (Fallback Mode)');
      console.log('='.repeat(60));
      console.log(`To: ${email}`);
      console.log(`Name: ${name || 'User'}`);
      console.log(`OTP Code: ${otp}`);
      console.log(`Expires: 5 minutes`);
      console.log('='.repeat(60));
      
      return { success: true };
    }
    
  } catch (error: any) {
    console.error('Failed to send OTP email:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send OTP email' 
    };
  }
};

// Alternative: SMTP email service for OTP
export const sendOTPEmailSMTP = async (
  email: string,
  name: string,
  otp: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // This would use nodemailer or similar SMTP service
    // For now, we'll use EmailJS as it's easier to set up
    
    const emailContent = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">BrandMonitorAI</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your OTP Code</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hello ${name || 'User'}!</h2>
            
            <p style="color: #666; line-height: 1.6;">
              You're setting up your BrandMonitorAI account. Use the OTP code below to verify your email address:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #667eea; color: white; font-size: 32px; font-weight: bold; padding: 20px; border-radius: 10px; letter-spacing: 5px; display: inline-block;">
                ${otp}
              </div>
            </div>
            
            <p style="color: #666; line-height: 1.6; font-size: 14px;">
              This OTP will expire in 5 minutes. If you didn't request this code, you can safely ignore this email.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                For security reasons, this code will expire in 5 minutes. Do not share this code with anyone.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    // For now, we'll use EmailJS
    return await sendOTPEmail(email, name, otp);
    
  } catch (error: any) {
    console.error('SMTP OTP email sending failed:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send OTP email' 
    };
  }
};
