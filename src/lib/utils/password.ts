import * as crypto from "crypto";

/**
 * Generate a secure random password with at least one character from each class:
 * lowercase, uppercase, digit, and special.
 */
export function generateSecurePassword(length: number = 12): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const special = "!@#$%^&*";
  const all = lowercase + uppercase + digits + special;

  // Ensure at least one of each type
  let password =
    lowercase[crypto.randomInt(lowercase.length)] +
    uppercase[crypto.randomInt(uppercase.length)] +
    digits[crypto.randomInt(digits.length)] +
    special[crypto.randomInt(special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[crypto.randomInt(all.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("");
}
