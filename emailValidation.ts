// Basic email validation to check format and block common disposable/role-based emails.
// Stricter, paid API checks (like Hunter.io) are commented out as per EMAIL_VALIDATION_FIX.md
// but can be re-enabled by providing API keys in .env.local.

const disposableDomains = new Set(['10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com']);
const roleBasedPrefixes = new Set(['admin', 'support', 'info', 'contact', 'sales', 'noreply']);

interface EmailValidationResult {
  valid: boolean;
  message: string;
}

export async function isValidEmail(email: string): Promise<EmailValidationResult> {
  // 1. Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Please enter a valid email address format.' };
  }

  const [prefix, domain] = email.split('@');

  // 2. Disposable email check
  if (disposableDomains.has(domain.toLowerCase())) {
    return { valid: false, message: 'Disposable email addresses are not allowed.' };
  }

  // 3. Role-based email check
  if (roleBasedPrefixes.has(prefix.toLowerCase())) {
    return { valid: false, message: 'Role-based email addresses (e.g., admin@, support@) are not allowed.' };
  }

  // 4. (Optional) Stricter, API-based existence check.
  // To enable, add HUNTER_API_KEY or ABSTRACT_API_KEY to your .env.local file
  // and uncomment the relevant code below.

  /*
  const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
  if (HUNTER_API_KEY) {
    try {
      const response = await fetch(`https://api.hunter.io/v2/email-verifier?email=${email}&api_key=${HUNTER_API_KEY}`);
      const data = await response.json();
      if (data.data.status !== 'deliverable') {
        return { valid: false, message: 'This email address does not exist or cannot receive emails.' };
      }
    } catch (error) {
      console.error("Hunter API error:", error);
      // Fallback to basic validation if API fails
    }
  }
  */

  return { valid: true, message: 'Email is valid.' };
}