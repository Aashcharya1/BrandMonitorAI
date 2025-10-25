// Email verification utilities using third-party services

interface EmailVerificationResult {
  isValid: boolean;
  isDisposable: boolean;
  isRole: boolean;
  isFree: boolean;
  isDeliverable: boolean;
  message?: string;
}

// Using EmailJS API for email verification
const EMAILJS_API_KEY = process.env.EMAILJS_API_KEY || 'your-emailjs-api-key';
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'your-service-id';

// Alternative: Using Hunter.io API for email verification
const HUNTER_API_KEY = process.env.HUNTER_API_KEY || 'your-hunter-api-key';

// Alternative: Using Abstract API for email verification
const ABSTRACT_API_KEY = process.env.ABSTRACT_API_KEY || 'your-abstract-api-key';

export const verifyEmailExistence = async (email: string): Promise<EmailVerificationResult> => {
  try {
    // First do basic checks (fast and reliable)
    if (isDisposableEmail(email)) {
      return {
        isValid: false,
        isDisposable: true,
        isRole: false,
        isFree: false,
        isDeliverable: false,
        message: 'Disposable email addresses are not allowed'
      };
    }

    if (isRoleEmail(email)) {
      return {
        isValid: false,
        isDisposable: false,
        isRole: true,
        isFree: false,
        isDeliverable: false,
        message: 'Role-based email addresses are not allowed'
      };
    }

    // For now, be permissive and accept all other emails
    // This prevents blocking valid emails when API keys are not configured
    return {
      isValid: true,
      isDisposable: false,
      isRole: false,
      isFree: false,
      isDeliverable: true,
      message: 'Email address appears valid'
    };

    // TODO: Uncomment below when you have API keys configured
    /*
    // Try multiple verification services for better accuracy
    const results = await Promise.allSettled([
      verifyWithHunter(email),
      verifyWithAbstract(email),
      verifyWithEmailJS(email)
    ]);

    // Process results and determine final verdict
    const validResults = results
      .filter((result): result is PromiseFulfilledResult<EmailVerificationResult> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    if (validResults.length === 0) {
      // If all services fail, be permissive and accept
      // This prevents blocking valid emails when API keys are not configured
      return {
        isValid: true,
        isDisposable: false,
        isRole: false,
        isFree: false,
        isDeliverable: true,
        message: 'Email address appears valid (verification service unavailable)'
      };
    }

    // Use the most reliable result (Hunter.io is usually most accurate)
    const primaryResult = validResults[0];
    
    return {
      isValid: primaryResult.isDeliverable && !primaryResult.isDisposable && !primaryResult.isRole,
      isDisposable: primaryResult.isDisposable,
      isRole: primaryResult.isRole,
      isFree: primaryResult.isFree,
      isDeliverable: primaryResult.isDeliverable,
      message: primaryResult.message
    };
    */

  } catch (error) {
    console.error('Email verification error:', error);
    return {
      isValid: true, // Default to valid on error to prevent blocking valid emails
      isDisposable: false,
      isRole: false,
      isFree: false,
      isDeliverable: true,
      message: 'Email verification service unavailable - accepting email'
    };
  }
};

// Hunter.io email verification
const verifyWithHunter = async (email: string): Promise<EmailVerificationResult> => {
  try {
    // Skip if no API key provided
    if (!HUNTER_API_KEY || HUNTER_API_KEY === 'your-hunter-api-key-here') {
      throw new Error('Hunter.io API key not configured');
    }

    const response = await fetch(`https://api.hunter.io/v2/email-verifier?email=${email}&api_key=${HUNTER_API_KEY}`);
    const data = await response.json();
    
    if (data.data) {
      const isDeliverable = data.data.result === 'deliverable';
      const isDisposable = data.data.disposable || false;
      const isRole = data.data.role || false;
      
      return {
        isValid: isDeliverable && !isDisposable && !isRole,
        isDisposable,
        isRole,
        isFree: data.data.free || false,
        isDeliverable,
        message: isDeliverable ? 'Email is deliverable' : 'Email is not deliverable'
      };
    }
    
    return {
      isValid: false,
      isDisposable: false,
      isRole: false,
      isFree: false,
      isDeliverable: false,
      message: 'Email verification failed'
    };
  } catch (error) {
    throw new Error('Hunter.io verification failed');
  }
};

// Abstract API email verification
const verifyWithAbstract = async (email: string): Promise<EmailVerificationResult> => {
  try {
    // Skip if no API key provided
    if (!ABSTRACT_API_KEY || ABSTRACT_API_KEY === 'your-abstract-api-key-here') {
      throw new Error('Abstract API key not configured');
    }

    const response = await fetch(`https://emailvalidation.abstractapi.com/v1/?api_key=${ABSTRACT_API_KEY}&email=${email}`);
    const data = await response.json();
    
    const isDeliverable = data.deliverability === 'DELIVERABLE';
    const isDisposable = data.is_disposable_email?.value || false;
    const isRole = data.is_role_email?.value || false;
    
    return {
      isValid: isDeliverable && !isDisposable && !isRole,
      isDisposable,
      isRole,
      isFree: data.is_free_email?.value || false,
      isDeliverable,
      message: isDeliverable ? 'Email is deliverable' : 'Email is not deliverable'
    };
  } catch (error) {
    throw new Error('Abstract API verification failed');
  }
};

// EmailJS verification (basic format check)
const verifyWithEmailJS = async (email: string): Promise<EmailVerificationResult> => {
  // EmailJS doesn't provide email verification, so we'll do basic checks
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidFormat = emailRegex.test(email);
  
  if (!isValidFormat) {
    return {
      isValid: false,
      isDisposable: false,
      isRole: false,
      isFree: false,
      isDeliverable: false,
      message: 'Invalid email format'
    };
  }
  
  // Check for common disposable email domains
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
    'mailinator.com', 'throwaway.email', 'temp-mail.org',
    'yopmail.com', 'maildrop.cc', 'getnada.com'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  const isDisposable = disposableDomains.includes(domain || '');
  
  // Check for role-based emails
  const rolePrefixes = ['admin', 'support', 'info', 'contact', 'sales', 'marketing', 'noreply', 'no-reply', 'postmaster'];
  const localPart = email.split('@')[0]?.toLowerCase();
  const isRole = rolePrefixes.includes(localPart || '');
  
  return {
    isValid: isValidFormat && !isDisposable && !isRole,
    isDisposable,
    isRole,
    isFree: false,
    isDeliverable: isValidFormat && !isDisposable && !isRole,
    message: isValidFormat ? 'Email format is valid' : 'Invalid email format'
  };
};

// Check if email is from a known disposable email service
export const isDisposableEmail = (email: string): boolean => {
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
    'mailinator.com', 'throwaway.email', 'temp-mail.org',
    'yopmail.com', 'maildrop.cc', 'getnada.com'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.includes(domain || '');
};

// Check if email is a role-based email
export const isRoleEmail = (email: string): boolean => {
  const rolePrefixes = [
    'admin', 'support', 'info', 'contact', 'sales',
    'marketing', 'noreply', 'no-reply', 'postmaster'
  ];
  
  const localPart = email.split('@')[0]?.toLowerCase();
  return rolePrefixes.includes(localPart || '');
};
