// Email validation utilities

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const getEmailValidationMessage = (email: string): string | null => {
  if (!email) return null;
  
  if (!isValidEmail(email)) {
    return 'Please enter a valid email address format (e.g., user@example.com)';
  }
  
  return null;
};

export const validateEmailDomain = (email: string): boolean => {
  // Check for common invalid domains
  const invalidDomains = [
    'example.com',
    'test.com',
    'invalid.com',
    'fake.com',
    'dummy.com'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return !invalidDomains.includes(domain);
};

export const getEmailDomainValidationMessage = (email: string): string | null => {
  if (!email) return null;
  
  if (!validateEmailDomain(email)) {
    return 'Please use a real email address, not a test domain';
  }
  
  return null;
};
