import { FastifyReply, FastifyBaseLogger } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { extractVideoId, downloadSubtitles } from './youtube';

// TypeBox schema for subtitle request
export const GetSubtitlesRequestSchema = Type.Object({
  url: Type.String({
    minLength: 1,
    description: 'YouTube video URL',
  }),
  type: Type.Optional(
    Type.Union([Type.Literal('official'), Type.Literal('auto')], {
      default: 'auto',
      description: 'Type of subtitles: official or auto-generated',
    })
  ),
  lang: Type.Optional(
    Type.String({
      pattern: '^[a-zA-Z0-9-]+$',
      minLength: 1,
      maxLength: 10,
      default: 'en',
      description: 'Language code (e.g., en, ru, en-US)',
    })
  ),
  cookies: Type.Optional(
    Type.String({
      minLength: 1,
      maxLength: 8192,
      description: 'Cookie header string (e.g., "SID=...; HSID=...")',
    })
  ),
});

export type GetSubtitlesRequest = Static<typeof GetSubtitlesRequestSchema>;

/**
 * Validates and sanitizes YouTube URL
 * @param url - URL to validate
 * @returns true if URL is valid, false otherwise
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Check that URL starts with http:// or https://
  if (!/^https?:\/\//.test(url)) {
    return false;
  }

  // Allow only valid YouTube domains
  const validDomains = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check that domain is valid
    const isValidDomain = validDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
    if (!isValidDomain) {
      return false;
    }

    // Check for video ID in URL
    return extractVideoId(url) !== null;
  } catch {
    return false;
  }
}

/**
 * Sanitizes video ID - allows only safe characters
 * @param videoId - video ID to sanitize
 * @returns sanitized video ID or null if contains invalid characters
 */
export function sanitizeVideoId(videoId: string): string | null {
  if (!videoId || typeof videoId !== 'string') {
    return null;
  }

  // YouTube video ID contains only letters, numbers, hyphens and underscores
  // Length is usually 11 characters, but can vary
  const sanitized = videoId.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    return null;
  }

  // Limit length for security
  if (sanitized.length > 50) {
    return null;
  }

  return sanitized;
}

/**
 * Sanitizes language code - allows only safe characters
 * @param lang - language code to sanitize
 * @returns sanitized language code or null if contains invalid characters
 */
export function sanitizeLang(lang: string): string | null {
  if (!lang || typeof lang !== 'string') {
    return null;
  }

  // Language code usually contains only letters, numbers and hyphens (e.g., en, en-US, ru)
  const sanitized = lang.trim();
  if (!/^[a-zA-Z0-9-]+$/.test(sanitized)) {
    return null;
  }

  // Limit length for security
  if (sanitized.length > 10) {
    return null;
  }

  return sanitized;
}

/**
 * Sanitizes cookies header value
 * @param cookies - Cookie header string to sanitize
 * @returns sanitized cookies or null if contains invalid characters
 */
export function sanitizeCookies(cookies: string): string | null {
  if (!cookies || typeof cookies !== 'string') {
    return null;
  }

  const sanitized = cookies.trim();
  if (sanitized.length === 0 || sanitized.length > 8192) {
    return null;
  }

  // Prevent header injection by rejecting CR/LF
  if (/[\r\n]/.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Validates request and downloads subtitles
 * @param logger - Fastify logger instance for structured logging
 * @returns object with subtitle data or null in case of error
 */
export async function validateAndDownloadSubtitles(
  request: GetSubtitlesRequest,
  reply: FastifyReply,
  logger?: FastifyBaseLogger
): Promise<{
  videoId: string;
  type: 'official' | 'auto';
  lang: string;
  subtitlesContent: string;
} | null> {
  const { url, type = 'auto', lang = 'en', cookies } = request;

  // Validate URL for valid YouTube URL
  // (basic validation already done by TypeBox, but check YouTube-specific requirements)
  if (!isValidYouTubeUrl(url)) {
    reply.code(400).send({
      error: 'Invalid YouTube URL',
      message: 'Please provide a valid YouTube video URL',
    });
    return null;
  }

  // Extract video ID
  const extractedVideoId = extractVideoId(url);
  if (!extractedVideoId) {
    reply.code(400).send({
      error: 'Invalid YouTube URL',
      message: 'Could not extract video ID from the provided URL',
    });
    return null;
  }

  // Sanitize video ID to prevent injection attacks
  const videoId = sanitizeVideoId(extractedVideoId);
  if (!videoId) {
    reply.code(400).send({
      error: 'Invalid video ID',
      message: 'Video ID contains invalid characters',
    });
    return null;
  }

  // Sanitize language code to prevent injection attacks
  const sanitizedLang = sanitizeLang(lang);
  if (!sanitizedLang) {
    reply.code(400).send({
      error: 'Invalid language code',
      message: 'Language code contains invalid characters',
    });
    return null;
  }

  let sanitizedCookies: string | undefined;
  if (cookies !== undefined) {
    const sanitized = sanitizeCookies(cookies);
    if (!sanitized) {
      reply.code(400).send({
        error: 'Invalid cookies',
        message: 'Cookies value contains invalid characters',
      });
      return null;
    }
    sanitizedCookies = sanitized;
  }

  // Download subtitles with specified parameters
  const subtitlesContent = await downloadSubtitles(
    videoId,
    type,
    sanitizedLang,
    logger,
    sanitizedCookies
  );

  if (!subtitlesContent) {
    reply.code(404).send({
      error: 'Subtitles not found',
      message: `No ${type} subtitles available for language "${sanitizedLang}"`,
    });
    return null;
  }

  return { videoId, type, lang: sanitizedLang, subtitlesContent };
}
