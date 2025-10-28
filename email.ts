import emailjs from '@emailjs/browser';

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!;
const OTP_TEMPLATE_ID = 'otp_template'; // As defined in your documentation

if (typeof window !== 'undefined') {
    emailjs.init(PUBLIC_KEY);
}

export async function sendOtpEmail(to_email: string, otp_code: string, to_name?: string) {
  if (!SERVICE_ID || !PUBLIC_KEY) {
    console.error('EmailJS environment variables are not set.');
    throw new Error('Email service is not configured.');
  }

  const templateParams = {
    to_email,
    otp_code,
    to_name: to_name || to_email,
    expiry_minutes: '5',
    app_name: 'BrandMonitorAI',
  };

  return emailjs.send(SERVICE_ID, OTP_TEMPLATE_ID, templateParams);
}