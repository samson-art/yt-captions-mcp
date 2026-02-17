# Use case: Researchers and batch processing

Fetch transcripts and metadata at scale for research, NLP pipelines, or data analysis — with search filters, playlist batch download, and pagination for long transcripts. No video or audio files are downloaded; only text and metadata.

## Who this is for

- **Researchers** and **data analysts** working with large sets of videos or transcripts.
- You need **filtered search** (by date, duration, live status), **playlist-level batch** transcripts, or **paginated raw subtitles** for long videos.
- You may run the server **self-hosted** with Redis cache and Prometheus for production workloads.

## Search with filters (search_videos)

Use **search_videos** to discover videos with yt-dlp’s search, then narrow results with optional parameters.

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `query` | Search query (required). | `"machine learning tutorial"` |
| `limit` | Max results (1–50, default 10). | `20` |
| `offset` | Skip first N results (pagination). | `10` |
| `uploadDateFilter` | Filter by upload date. | `week`, `month`, `year` |
| `dateBefore` | yt-dlp `--datebefore`. | `now-1year`, `20241201` |
| `date` | Exact date. | `20231215`, `today-2weeks` |
| `matchFilter` | yt-dlp `--match-filter`. | `!is_live`, `duration < 3600` |
| `response_format` | Human-readable format. | `json` (default) or `markdown` |

### Example: recent short videos

- **search_videos**: `query: "python asyncio"`, `limit: 20`, `uploadDateFilter: "month"`, `matchFilter: "duration < 1800"`  
  → Only videos under 30 minutes uploaded in the last month.

### Example: exclude live streams

- **search_videos**: `query: "keynote 2024"`, `matchFilter: "!is_live"`  
  → No live streams in results.

### Example: paginate search results

- First call: `query: "climate change"`, `limit: 50`, `offset: 0`.  
- Next page: same `query` and `limit`, `offset: 50`, then `offset: 100`, and so on.

Then feed each result’s `url` (or `videoId`) into **get_transcript** or **get_raw_subtitles**.

## Playlist batch (get_playlist_transcripts)

Fetch cleaned transcripts for **multiple videos** from one playlist in a single tool call (or a few calls with `playlistItems`).

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `url` | Playlist URL or watch URL with `list=`. | `https://www.youtube.com/playlist?list=XXX` |
| `type` | Subtitle track: `official` or `auto` (default). | `auto` |
| `lang` | Language code. | `en`, `ru` |
| `format` | Subtitle format. | `srt`, `vtt`, `ass`, `lrc` |
| `playlistItems` | yt-dlp `-I` spec. | `1:5`, `1,3,7`, `-1` (last), `1:10:2` (every 2nd) |
| `maxItems` | Max videos to process (yt-dlp `--max-downloads`). | `50` |

### Example: first 10 videos of a playlist

- **get_playlist_transcripts**: `url: "https://www.youtube.com/playlist?list=PL..."`
  - Optional: `playlistItems: "1:10"` or `maxItems: 10`.  
  → Returns `results`: array of `{ videoId, text }`.

### Example: specific indices and language

- **get_playlist_transcripts**: `url: "<playlist URL>"`, `playlistItems: "1,5,10,15"`, `lang: "en"`, `type: "official"`  
  → Only items 1, 5, 10, 15; English official subtitles when available.

### Example: avoid re-downloading (self-hosted)

When running your own server, set **`YT_DLP_DOWNLOAD_ARCHIVE`** to a file path. yt-dlp will skip videos already in the archive and stop on first existing (see [configuration.md](configuration.md)). Useful for incremental playlist runs.

## Long transcripts: pagination (get_raw_subtitles)

For **long videos**, use **get_raw_subtitles** with `response_limit` and `next_cursor` to fetch the full transcript in chunks.

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `url` | Video URL or YouTube video ID. | required |
| `response_limit` | Max characters per response (1000–200000, default 50000). | `50000` |
| `next_cursor` | Opaque cursor from previous response. | from last call |
| `type`, `lang`, `format` | Optional: track and format. | `auto`, `en`, `srt` |

### Example: full transcript in chunks

1. **get_raw_subtitles**: `url: "<video URL>"`, `response_limit: 50000`.  
   → Response includes `content`, `is_truncated`, `total_length`, `next_cursor`.
2. If `is_truncated` is true, call again with the same `url` and `next_cursor` from step 1.
3. Repeat until `is_truncated` is false; concatenate `content` (or store chunks) for your pipeline.

Same pattern works for **get_transcript** when you only need plain text (it returns the first chunk by default; for more, use **get_raw_subtitles** and strip timestamps in your code if needed).

## REST API for scripts and backends

If you prefer HTTP instead of MCP (e.g. Python, R, or cron jobs):

- **POST /subtitles** — get cleaned transcript (body: `url`, optional `type`, `lang`, `format`).
- **POST /subtitles/raw** — raw subtitles with pagination (see API docs).
- **GET /videos/:id** (or equivalent) — metadata; see [quick-start.rest.md](quick-start.rest.md) and Swagger at `/docs`.

Run the REST API with Docker or Node; use the same Redis cache and env vars as for MCP (see [configuration.md](configuration.md)).

## Self-hosted and performance

- **Redis cache:** Set `CACHE_MODE=redis` and `CACHE_REDIS_URL` to cache subtitles and metadata and reduce yt-dlp calls (see [caching.md](caching.md)).
- **Rate limiting and sleep:** Use `YT_DLP_SLEEP_REQUESTS`, `YT_DLP_SLEEP_SUBTITLES`, and MCP/API rate limits to avoid platform throttling (see [configuration.md](configuration.md)).
- **Monitoring:** Scrape Prometheus metrics and use `GET /failures` for failed URLs (see [monitoring.md](monitoring.md)).
- **Self-hosted deployment:** See [use-case-self-hosted.md](use-case-self-hosted.md) for auth, Docker, and monitoring in one place.

## See also

- [Search and get transcript](use-case-search-and-transcript.md) — basic search + transcript flow.
- [n8n automation](use-case-n8n-automation.md) — playlist and search in workflows.
- [Configuration](configuration.md) — env vars for yt-dlp, cache, and rate limits.
- [Monitoring](monitoring.md) — Prometheus and failures endpoint.
