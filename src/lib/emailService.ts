// Email service using EmailJS for sending verification emails
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'your-service-id';
const EMAILJS_TEMPLATE_ID = 'verification_template'; // We'll create this template
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'your-public-key';

export interface EmailTemplate {
  to_email: string;
  to_name: string;
  verification_url: string;
  app_name: string;
}

export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationUrl: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Initialize EmailJS
    emailjs.init(EMAILJS_PUBLIC_KEY);
    
    const templateParams: EmailTemplate = {
      to_email: email,
      to_name: name || 'User',
      verification_url: verificationUrl,
      app_name: 'BrandMonitorAI'
    };
    
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );
    
    console.log('Email sent successfully:', response);
    return { success: true };
    
  } catch (error: any) {
    console.error('Failed to send verification email:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send verification email' 
    };
  }
};

// Alternative: SMTP email service (if you prefer to use a different email service)
export const sendVerificationEmailSMTP = async (
  email: string,
  name: string,
  verificationUrl: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // This would use nodemailer or similar SMTP service
    // For now, we'll use EmailJS as it's easier to set up
    
    const emailContent = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to BrandMonitorAI!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Please verify your email address to get started</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hello ${name || 'User'}!</h2>
            
            <p style="color: #666; line-height: 1.6;">
              Thank you for signing up with BrandMonitorAI. To complete your registration and start monitoring your brand, 
              please verify your email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        text-decoration: none; 
                        padding: 15px 30px; 
                        border-radius: 25px; 
                        display: inline-block; 
                        font-weight: bold; 
                        font-size: 16px;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; font-size: 14px;">
              If the button doesn't work, you can also copy and paste this link into your browser:
            </p>
            
            <p style="color: #667eea; word-break: break-all; font-size: 14px; background: #f1f3f4; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This verification link will expire in 24 hours. If you didn't create an account with BrandMonitorAI, 
                you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    // For now, we'll use EmailJS
    return await sendVerificationEmail(email, name, verificationUrl);
    
  } catch (error: any) {
    console.error('SMTP email sending failed:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send verification email' 
    };
  }
};
