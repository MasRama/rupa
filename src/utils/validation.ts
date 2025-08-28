/**
 * Validation utility functions for Discord bot inputs
 */

/**
 * Validate Discord token format
 */
export function isValidDiscordToken(token: string): boolean {
  // Discord bot tokens typically start with 'Bot ' or are 59+ characters
  return token.length > 50 && /^[A-Za-z0-9._-]+$/.test(token.replace(/^Bot /, ''));
}

/**
 * Validate Discord client ID format
 */
export function isValidClientId(clientId: string): boolean {
  return /^\d{17,19}$/.test(clientId);
}

/**
 * Validate username format (Discord-compliant)
 */
export function isValidUsername(username: string): boolean {
  return username.length >= 2 && username.length <= 32 && !/[@#:`]/.test(username);
}

/**
 * Validate guild/server name
 */
export function isValidGuildName(name: string): boolean {
  return name.length >= 2 && name.length <= 100;
}

/**
 * Validate command prefix
 */
export function isValidPrefix(prefix: string): boolean {
  return prefix.length >= 1 && prefix.length <= 5 && !/\s/.test(prefix);
}

/**
 * Validate reason text for moderation actions
 */
export function isValidReason(reason: string): boolean {
  return reason.length <= 512; // Discord audit log reason limit
}

/**
 * Validate message content
 */
export function isValidMessageContent(content: string): boolean {
  return content.length > 0 && content.length <= 2000; // Discord message limit
}

/**
 * Validate embed title
 */
export function isValidEmbedTitle(title: string): boolean {
  return title.length <= 256; // Discord embed title limit
}

/**
 * Validate embed description
 */
export function isValidEmbedDescription(description: string): boolean {
  return description.length <= 4096; // Discord embed description limit
}

/**
 * Validate embed field name
 */
export function isValidEmbedFieldName(name: string): boolean {
  return name.length > 0 && name.length <= 256; // Discord embed field name limit
}

/**
 * Validate embed field value
 */
export function isValidEmbedFieldValue(value: string): boolean {
  return value.length > 0 && value.length <= 1024; // Discord embed field value limit
}

/**
 * Validate color hex code
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color);
}

/**
 * Validate integer within range
 */
export function isValidInteger(value: any, min?: number, max?: number): boolean {
  const num = parseInt(value);
  if (isNaN(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize user input by removing potentially harmful characters
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>\"'&]/g, '') // Remove HTML/script injection characters
    .trim()
    .substring(0, 2000); // Limit length
}

/**
 * Validate JSON string
 */
export function isValidJSON(jsonString: string): boolean {
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate time duration in various formats (e.g., "1h", "30m", "1d")
 */
export function isValidDuration(duration: string): boolean {
  return /^\d+[smhd]$/.test(duration);
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid duration format');
  
  const [, amount, unit] = match;
  const num = parseInt(amount);
  
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: throw new Error('Invalid duration unit');
  }
}