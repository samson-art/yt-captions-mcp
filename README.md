# YouTube Captions Downloader API

A RESTful API service for extracting subtitles from YouTube videos. Supports both official and auto-generated subtitles in multiple languages.

## Features

- 🎬 Extract video ID from YouTube URLs
- 📝 Download subtitles (official → auto-generated fallback)
- 🌍 Support for multiple languages
- 📄 SRT and VTT format support
- 🧹 Clean subtitles (remove timestamps and formatting)
- 📋 Return plain text or raw subtitle content
- 🐳 Dockerized for easy deployment
- 🚀 Built with Fastify for high performance
- 🛡️ Rate limiting and error handling

## Requirements

- **Docker** (recommended for production)
- **Node.js** >= 20.0.0 (for local development)
- **yt-dlp** (included in Docker image)

## Quick Start

### Using Docker (Recommended)

The Docker image includes all necessary dependencies: Node.js and yt-dlp.

The server runs on port 3000 by default (or the port specified in the `PORT` environment variable).

#### Build the image

```bash
docker build -t yt-captions-downloader .
```

#### Run the container

```bash
docker run -p 3000:3000 yt-captions-downloader
```

#### Run with custom port

```bash
docker run -p 8080:8080 -e PORT=8080 yt-captions-downloader
```

#### Environment Variables

- `PORT` - Server port (default: `3000`)
- `HOST` - Server host (default: `0.0.0.0`)
- `YT_DLP_TIMEOUT` - Timeout for yt-dlp command in milliseconds (default: `60000` - 60 seconds)
- `RATE_LIMIT_MAX` - Maximum number of requests per time window (default: `100`)
- `RATE_LIMIT_TIME_WINDOW` - Time window for rate limiting (default: `1 minute`)
- `SHUTDOWN_TIMEOUT` - Graceful shutdown timeout in milliseconds (default: `10000` - 10 seconds)

**Example with custom yt-dlp timeout:**

```bash
docker run -p 3000:3000 -e YT_DLP_TIMEOUT=120000 yt-captions-downloader
```

#### Run in background

```bash
docker run -d -p 3000:3000 --name yt-captions yt-captions-downloader
```

#### View logs

```bash
docker logs -f yt-captions
```

#### Stop the container

```bash
docker stop yt-captions
docker rm yt-captions
```

## API Documentation

### POST /api/subtitles

Retrieve cleaned subtitles (plain text without timestamps) from a YouTube video.

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "type": "auto",
  "lang": "en"
}
```

**Parameters:**
- `url` (required) - YouTube video URL
- `type` (optional, default: `"auto"`) - Subtitle type: `"official"` (official subtitles) or `"auto"` (auto-generated subtitles)
- `lang` (optional, default: `"en"`) - Subtitle language code (e.g., `"en"`, `"ru"`, `"es"`, `"fr"`)

**Response (Success):**
```json
{
  "videoId": "VIDEO_ID",
  "type": "auto",
  "lang": "en",
  "text": "Plain text subtitles without timestamps...",
  "length": 1234
}
```

**Response (Error):**
```json
{
  "error": "Error type",
  "message": "Error message"
}
```

**Example Requests:**

Auto-generated subtitles in English (default):
```bash
curl -X POST http://localhost:3000/api/subtitles \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

Official subtitles in Russian:
```bash
curl -X POST http://localhost:3000/api/subtitles \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "type": "official", "lang": "ru"}'
```

Auto-generated subtitles in Spanish:
```bash
curl -X POST http://localhost:3000/api/subtitles \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "type": "auto", "lang": "es"}'
```

### POST /api/subtitles/raw

Retrieve raw subtitles from a YouTube video without cleaning (includes timestamps and formatting).

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "type": "auto",
  "lang": "en"
}
```

**Parameters:**
- `url` (required) - YouTube video URL
- `type` (optional, default: `"auto"`) - Subtitle type: `"official"` or `"auto"`
- `lang` (optional, default: `"en"`) - Subtitle language code

**Response (Success):**
```json
{
  "videoId": "VIDEO_ID",
  "type": "auto",
  "lang": "en",
  "format": "srt",
  "content": "1\n00:00:00,000 --> 00:00:05,000\nHello world\n\n2\n00:00:05,000 --> 00:00:10,000\n...",
  "length": 1234
}
```

**Response Fields:**
- `videoId` - YouTube video ID
- `type` - Subtitle type (`"official"` or `"auto"`)
- `lang` - Subtitle language code
- `format` - Subtitle format (`"srt"` or `"vtt"`)
- `content` - Raw subtitle file content (SRT or VTT format) without processing
- `length` - Content length in characters

**Response (Error):**
```json
{
  "error": "Error type",
  "message": "Error message"
}
```

**Example Requests:**

Get raw auto-generated subtitles in English:
```bash
curl -X POST http://localhost:3000/api/subtitles/raw \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

Get raw official subtitles in Russian:
```bash
curl -X POST http://localhost:3000/api/subtitles/raw \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "type": "official", "lang": "ru"}'
```

### GET /health

Health check endpoint to verify the server is running.

**Response:**
```json
{
  "status": "ok"
}
```

## How It Works

1. The API receives a YouTube URL and parameters (subtitle type and language) from the client
2. Extracts the video ID from the URL
3. Uses `yt-dlp` to download subtitles with the specified parameters:
   - Single `yt-dlp` command call with explicit type (`--write-subs` or `--write-auto-subs`) and language (`--sub-lang`)
4. Parses the subtitle file (SRT/VTT) and removes:
   - Timestamps
   - Subtitle numbers
   - HTML tags
   - Formatting
5. Returns clean plain text (for `/api/subtitles`) or raw content (for `/api/subtitles/raw`)

## Development

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn
- yt-dlp installed and available in PATH

### Scripts

- `npm run build` - Build the TypeScript project
- `npm start` - Run the compiled application
- `npm run dev` - Run with hot reload using ts-node-dev
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Lint the code
- `npm run lint:fix` - Fix linting errors
- `npm run type-check` - Type check without building
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Project Structure

```
├── src/
│   ├── index.ts          # Main application entry point
│   ├── validation.ts     # Request validation logic
│   └── youtube.ts        # YouTube subtitle downloading and parsing
├── dist/                 # Compiled JavaScript (generated)
├── Dockerfile            # Docker image configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Technologies

- **TypeScript** - Type-safe JavaScript
- **Node.js** - Runtime environment
- **Fastify** - Fast and low overhead web framework
- **yt-dlp** - YouTube content downloader
- **Docker** - Containerization
- **Jest** - Testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please make sure your code passes all tests and linting checks before submitting.

## License

MIT License

Copyright (c) 2025 samson-art

See [LICENSE](LICENSE) file for details.

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/samson-art/yt-captions-downloader/issues)
- 💡 **Feature Requests**: [GitHub Issues](https://github.com/samson-art/yt-captions-downloader/issues)
- 📧 **Contact**: [GitHub Profile](https://github.com/samson-art)
