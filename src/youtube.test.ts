import { extractVideoId, detectSubtitleFormat, parseSubtitles } from './youtube';

describe('youtube', () => {
  describe('extractVideoId', () => {
    it('should extract video ID from standard YouTube URLs', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from URLs with additional parameters', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toBe(
        'dQw4w9WgXcQ'
      );
      expect(extractVideoId('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      );
    });

    it('should return null for invalid URLs', () => {
      expect(extractVideoId('not-a-url')).toBe(null);
      expect(extractVideoId('https://example.com')).toBe(null);
      expect(extractVideoId('')).toBe(null);
    });
  });

  describe('detectSubtitleFormat', () => {
    it('should detect VTT format', () => {
      const vttContent = 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world';
      expect(detectSubtitleFormat(vttContent)).toBe('vtt');
    });

    it('should detect SRT format', () => {
      const srtContent = '1\n00:00:00,000 --> 00:00:05,000\nHello world';
      expect(detectSubtitleFormat(srtContent)).toBe('srt');
    });

    it('should default to SRT for content without WEBVTT header', () => {
      expect(detectSubtitleFormat('Some text')).toBe('srt');
      expect(detectSubtitleFormat('')).toBe('srt');
    });
  });

  describe('parseSubtitles', () => {
    it('should parse SRT format correctly', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Hello world

2
00:00:05,000 --> 00:00:10,000
This is a test`;

      const result = parseSubtitles(srtContent);
      expect(result).toBe('Hello world This is a test');
    });

    it('should parse VTT format correctly', () => {
      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
Hello world

00:00:05.000 --> 00:00:10.000
This is a test`;

      const result = parseSubtitles(vttContent);
      expect(result).toBe('Hello world This is a test');
    });

    it('should remove HTML tags from subtitles', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Hello <b>world</b>`;

      const result = parseSubtitles(srtContent);
      expect(result).toBe('Hello world');
    });

    it('should remove sound labels from subtitles', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Hello [music] world [applause]`;

      const result = parseSubtitles(srtContent);
      expect(result).toBe('Hello world');
    });

    it('should remove speaker markers from subtitles', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
>> Hello world`;

      const result = parseSubtitles(srtContent);
      expect(result).toBe('Hello world');
    });

    it('should handle empty subtitles', () => {
      expect(parseSubtitles('')).toBe('');
      expect(parseSubtitles('WEBVTT')).toBe('');
    });

    it('should handle subtitles with only timestamps', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000

2
00:00:05,000 --> 00:00:10,000`;

      const result = parseSubtitles(srtContent);
      expect(result).toBe('');
    });

    it('should handle multiline subtitle text', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Line one
Line two
Line three`;

      const result = parseSubtitles(srtContent);
      expect(result).toBe('Line one Line two Line three');
    });

    it('should clean up multiple spaces', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Hello    world     test`;

      const result = parseSubtitles(srtContent);
      expect(result).toBe('Hello world test');
    });

    it('should handle complex VTT with metadata', () => {
      const vttContent = `WEBVTT
NOTE This is a note

00:00:00.000 --> 00:00:05.000
Hello world

00:00:05.000 --> 00:00:10.000
This is a test`;

      const result = parseSubtitles(vttContent);
      expect(result).toBe('Hello world This is a test');
    });

    it('should skip NOTE lines in VTT', () => {
      const vttContent = `WEBVTT
NOTE This is a note

00:00:00.000 --> 00:00:05.000
Hello world`;

      const result = parseSubtitles(vttContent);
      expect(result).toBe('Hello world');
    });
  });
});
