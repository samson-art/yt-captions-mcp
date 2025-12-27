import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { FastifyBaseLogger } from 'fastify';

const execFileAsync = promisify(execFile);

/**
 * Extracts video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Downloads subtitles using yt-dlp
 * @param videoId - YouTube video ID
 * @param type - subtitle type: 'official' or 'auto'
 * @param lang - subtitle language (e.g., 'en', 'ru')
 * @param logger - Fastify logger instance for structured logging
 */
export async function downloadSubtitles(
  videoId: string,
  type: 'official' | 'auto' = 'auto',
  lang: string = 'en',
  logger?: FastifyBaseLogger
): Promise<string | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const tempDir = tmpdir();
  const timestamp = Date.now();
  const outputPath = join(tempDir, `subtitles_${videoId}_${timestamp}`);

  try {
    // Build command arguments depending on subtitle type
    // Use array of arguments instead of string to prevent command injection
    const subFlag = type === 'official' ? '--write-subs' : '--write-auto-subs';
    const args = [
      subFlag,
      '--skip-download',
      '--sub-lang',
      lang, // lang is already sanitized in validation.ts
      '--sub-format',
      'srt/vtt',
      '--output',
      `${outputPath}.%(ext)s`,
      videoUrl, // videoUrl is built from sanitized videoId
    ];

    logger?.info(
      { videoId, type, lang },
      `Downloading ${type} subtitles for ${videoId} in language ${lang}`
    );

    try {
      // Use execFile instead of exec for safe argument passing
      // This prevents command injection as arguments are passed separately
      const timeout = process.env.YT_DLP_TIMEOUT
        ? Number.parseInt(process.env.YT_DLP_TIMEOUT, 10)
        : 60000; // 60 seconds default
      const { stdout, stderr } = await execFileAsync('yt-dlp', args, {
        maxBuffer: 10 * 1024 * 1024,
        timeout,
      });
      logger?.debug({ stdout }, 'yt-dlp stdout');
      if (stderr) logger?.debug({ stderr }, 'yt-dlp stderr');

      // Small delay in case file is still being written
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Search for downloaded subtitle file
      const subtitleFile = await findSubtitleFile(outputPath, tempDir, logger);

      if (subtitleFile) {
        const content = await readFile(subtitleFile, 'utf-8');
        // Check that file is not empty
        if (content.trim().length > 0) {
          await unlink(subtitleFile).catch(() => {});
          return content;
        }
      }
    } catch (error: any) {
      logger?.error(
        { error: error.message, videoId, type, lang, stdout: error.stdout, stderr: error.stderr },
        `Error downloading ${type} subtitles for ${videoId}`
      );

      // Even if command returned an error, file might have been created
      // (e.g., with 429 error file might already be written)
      logger?.debug({ videoId }, 'Checking for subtitle file despite error...');
      await new Promise((resolve) => setTimeout(resolve, 100));

      const subtitleFile = await findSubtitleFile(outputPath, tempDir, logger);
      logger?.debug({ videoId, subtitleFile }, 'subtitleFile found after error');

      if (subtitleFile) {
        try {
          const content = await readFile(subtitleFile, 'utf-8');
          if (content.trim().length > 0) {
            await unlink(subtitleFile).catch(() => {});
            return content;
          }
        } catch (readError) {
          logger?.error({ error: readError, videoId, subtitleFile }, 'Error reading subtitle file');
        }
      }
    }

    return null;
  } catch (error) {
    logger?.error({ error, videoId }, `Error downloading subtitles for ${videoId}`);
    return null;
  }
}

/**
 * Finds subtitle file in the specified directory
 * yt-dlp creates files in format: baseName.language.srt or baseName.language.vtt
 * @param logger - Fastify logger instance for structured logging
 */
async function findSubtitleFile(
  basePath: string,
  searchDir?: string,
  logger?: FastifyBaseLogger
): Promise<string | null> {
  const { readdir } = await import('node:fs/promises');
  const { dirname, basename } = await import('node:path');

  try {
    const dir = searchDir || dirname(basePath);
    const baseName = basename(basePath);
    const files = await readdir(dir);

    logger?.debug(
      {
        dir,
        baseName,
        subtitleFiles: files.filter((f) => f.endsWith('.srt') || f.endsWith('.vtt')),
      },
      'Searching for subtitle file'
    );

    // yt-dlp creates files in format: baseName.language.srt or baseName.language.vtt
    // For example: subtitles_VIDEO_ID_TIMESTAMP_auto.en.srt
    // Search for files with .srt or .vtt extensions that start with baseName
    const subtitleFile = files.find((file) => {
      const startsWithBase = file.startsWith(baseName);
      const hasSubtitleExt = file.endsWith('.srt') || file.endsWith('.vtt');
      const matchesPattern = startsWithBase && hasSubtitleExt;

      if (matchesPattern) {
        logger?.debug({ file, baseName }, 'Found matching subtitle file');
      }

      return matchesPattern;
    });

    // If exact match not found, try to find files that contain baseName
    // (in case the name format is slightly different)
    if (!subtitleFile) {
      const alternativeFile = files.find((file) => {
        const hasSubtitleExt = file.endsWith('.srt') || file.endsWith('.vtt');
        const containsBaseName = file.includes(baseName);
        return hasSubtitleExt && containsBaseName;
      });

      if (alternativeFile) {
        logger?.debug({ file: alternativeFile }, 'Found alternative matching subtitle file');
        return join(dir, alternativeFile);
      }
    }

    if (subtitleFile) {
      return join(dir, subtitleFile);
    }

    // If not found by exact match, search for any .srt/.vtt files that might be ours
    // (in case yt-dlp uses a different name format)
    const anySubtitleFile = files.find((file) => {
      const hasSubtitleExt = file.endsWith('.srt') || file.endsWith('.vtt');
      // Проверяем, что файл содержит videoId или timestamp
      const containsVideoId = file.includes(basePath.split('_')[1]) || file.includes(basePath);
      return hasSubtitleExt && containsVideoId;
    });

    if (anySubtitleFile) {
      logger?.debug({ file: anySubtitleFile }, 'Found alternative subtitle file');
      return join(dir, anySubtitleFile);
    }

    return null;
  } catch (error) {
    logger?.error({ error, basePath }, 'Error finding subtitle file');
    return null;
  }
}

/**
 * Detects subtitle format by content
 * @param content - subtitle file content
 * @returns 'vtt' if format is VTT, otherwise 'srt'
 */
export function detectSubtitleFormat(content: string): 'srt' | 'vtt' {
  return content.startsWith('WEBVTT') ? 'vtt' : 'srt';
}

/**
 * Parses subtitles (SRT or VTT) and returns plain text without timestamps
 * @param content - subtitle content
 * @param logger - Fastify logger instance for structured logging
 */
export function parseSubtitles(content: string, logger?: FastifyBaseLogger): string {
  const format = detectSubtitleFormat(content);

  switch (format) {
    case 'vtt':
      return parseVTT(content, logger);
    case 'srt':
      return parseSRT(content, logger);
    default:
      throw new Error(`Unsupported subtitle format: ${format}`);
  }
}

/**
 * Cleans subtitle line from formatting and service elements
 */
function cleanSubtitleLine(line: string): string {
  let cleanLine = line;

  // Remove HTML tags
  cleanLine = cleanLine.replace(/<[^>]+>/g, '');

  // Remove speaker markers (>>)
  cleanLine = cleanLine.replace(/^>>\s*/g, '').replace(/\s*>>\s*/g, ' ');

  // Remove sound labels in square brackets: [music], [applause], [laughter], etc.
  cleanLine = cleanLine.replace(/\[[^\]]+\]/g, '');

  // Remove VTT cue settings
  cleanLine = cleanLine.replace(/::cue\([^)]+\)\s*\{[^}]*\}/g, '');

  // Remove multiple spaces
  cleanLine = cleanLine.replace(/\s+/g, ' ').trim();

  return cleanLine;
}

/**
 * Parses SRT format
 * @param content - SRT subtitle content
 * @param logger - Fastify logger instance for structured logging
 */
function parseSRT(content: string, logger?: FastifyBaseLogger): string {
  logger?.debug('Parsing SRT content');
  const lines = content.split('\n');
  const textLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines and numbers
    if (line === '' || /^\d+$/.test(line)) {
      i++;
      continue;
    }

    // Skip timestamps (format: 00:00:00,000 --> 00:00:00,000)
    if (/^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(line)) {
      i++;
      continue;
    }

    // This is subtitle text
    if (line.length > 0) {
      let cleanLine = cleanSubtitleLine(line);

      // Remove index numbers: numbers at the beginning of line followed by space
      cleanLine = cleanLine.replace(/^\d+\s+/g, '');

      // Remove index numbers that stand alone between words
      // Pattern: space, number, space (but not numbers that are part of words or phrases)
      cleanLine = cleanLine.replace(/\s+\d+\s+/g, ' ');

      // Remove numbers at the end of line before space (if it's an index)
      cleanLine = cleanLine.replace(/\s+\d+$/g, '');

      // Final space cleanup
      cleanLine = cleanLine.replace(/\s+/g, ' ').trim();

      if (cleanLine.length > 0) {
        textLines.push(cleanLine);
      }
    }

    i++;
  }

  return textLines.join(' ');
}

/**
 * Parses VTT format
 * @param content - VTT subtitle content
 * @param logger - Fastify logger instance for structured logging
 */
function parseVTT(content: string, logger?: FastifyBaseLogger): string {
  logger?.debug('Parsing VTT content');
  const lines = content.split('\n');
  const textLines: string[] = [];
  let i = 0;

  // Skip WEBVTT header and metadata
  while (
    i < lines.length &&
    (lines[i].startsWith('WEBVTT') || lines[i].startsWith('NOTE') || lines[i].trim() === '')
  ) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (line === '') {
      i++;
      continue;
    }

    // Skip timestamps (format: 00:00:00.000 --> 00:00:00.000)
    if (/^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(line)) {
      i++;
      continue;
    }

    // Skip styles and settings
    if (line.startsWith('STYLE') || line.startsWith('::cue') || line.startsWith('NOTE')) {
      i++;
      continue;
    }

    // This is subtitle text
    if (line.length > 0) {
      const cleanLine = cleanSubtitleLine(line);

      if (cleanLine.length > 0) {
        textLines.push(cleanLine);
      }
    }

    i++;
  }

  return textLines.join(' ');
}
