# YouTube Prequalification Pipeline

```
                         100 discovered creators
                                  |
                                  v
                   ┌──────────────────────────┐
                   │  1. Resolve Channel ID    │  FREE
                   │  YouTube API (1 unit/ea)   │  via channels.list?forHandle
                   │  or direct parse from URL  │
                   └──────────────────────────┘
                                  |
                                  v
                   ┌──────────────────────────┐
                   │  2. Get Latest Video       │  FREE
                   │  RSS Feed                  │  youtube.com/feeds/videos.xml
                   │  (no API key needed)       │  ?channel_id=UC...
                   └──────────────────────────┘
                                  |
                                  v
                   ┌──────────────────────────┐
                   │  3. Fetch Transcript       │  PAID
                   │  Supadata API              │  1 credit / video
                   │  (sequential, 1.2s delay)  │  @supadata/js
                   └──────────────────────────┘
                                  |
                                  v
                   ┌──────────────────────────┐
                   │  4. AI Stage 1             │  Builder API
                   │  Batch score 100 creators  │  Haiku — 10 batches of 10
                   │  (0-100 campaign fit)      │  No-transcript creators
                   │                            │  capped at score 20
                   └──────────────────────────┘
                                  |
                                  v
                   ┌──────────────────────────┐
                   │  5. AI Stage 2             │  Builder API
                   │  Rank top 20 → pick 10    │  Sonnet
                   │  (or fallback to Stage 1   │
                   │   top 10 if Stage 2 fails) │
                   └──────────────────────────┘
                                  |
                                  v
                   ┌──────────────────────────┐
                   │  6. Persist Results        │
                   │  Selected → ingested       │  campaign_creators table
                   │  Excluded → excluded       │  + content_items
                   │  + activity_log entry       │
                   └──────────────────────────┘


Cost per run (100 creators):
  YouTube API .... ~100 units (free tier = 10,000/day)
  RSS ............ 0
  Supadata ....... 100 credits (1 per transcript)
  AI ............. ~11 builder API calls

Environment variables:
  YOUTUBE_API_KEY ...... YouTube Data API v3 key
  SUPADATA_API_KEY ..... supadata.ai API key
  PREQUALIFY_LIMIT ..... cap creators processed (default 100, use 5 for testing)
```
