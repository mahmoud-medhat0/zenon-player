# Development Phases & Tasks

## Phase 1: Core MVP (Local/GDrive, MP4/HLS generation, Basic Player)
- `[ ]` **Project Setup**
  - `[ ]` Initialize Laravel 13 backend (`api.php` routing, database setup)
  - `[ ]` Initialize React + TypeScript frontend (Vite or Next.js)
  - `[ ]` Set up Docker environment (PostgreSQL, Redis, Laravel, Vite)
- `[ ]` **Storage & Database Foundation**
  - `[ ]` Configure Flysystem for multi-driver support (Local, GDrive)
  - `[ ]` Create database migrations (`tenants`, `users`, `videos`, `video_versions`)
  - `[ ]` Implement base Models and Relationships
- `[ ]` **Auth & Tenant Management**
  - `[ ]` Implement JWT Auth / Laravel Sanctum
  - `[ ]` Create basic Tenant middleware (Global Scopes)
- `[ ]` **Video Ingestion & Processing**
  - `[ ]` API: Create `/upload-intent` endpoint (Proxied chunking or direct)
  - `[ ]` API: Create `/confirm-upload` endpoint
  - `[ ]` Worker: Configure Laravel Horizon and Redis queues
  - `[ ]` Worker: Implement FFmpeg probe & thumbnail generation job
  - `[ ]` Worker: Implement basic MP4/HLS single-resolution transcode job
- `[ ]` **Frontend MVP**
  - `[ ]` Dashboard: Video list & basic layout
  - `[ ]` Upload: Chunked file uploader UI
  - `[ ]` Player: Implement basic React video player (Video.js/Hls.js wrapper)

## Phase 2: SaaS Foundation (Billing, Teams, Multi-bitrate)
- `[ ]` **Billing & Teams**
  - `[ ]` Integrate Stripe Billing (Subscriptions, Invoices)
  - `[ ]` Implement Team/Tenant RBAC (Owner, Admin, Editor, Viewer)
- `[ ]` **Advanced Processing**
  - `[ ]` Worker: Multi-bitrate HLS transcoding (360p, 720p, 1080p)
  - `[ ]` Worker: Optimize FFmpeg passes for speed vs quality

## Phase 3: Delivery & Security
- `[ ]` **CDN & Edge Security**
  - `[ ]` Integrate Bunny CDN (Token Authentication)
  - `[ ]` API: Generate expiring CDN signed URLs
  - `[ ]` API: Implement Domain Restriction checks & CORS
  - `[ ]` API: Password protected videos
  
## Phase 4: Advanced Player & Analytics
- `[ ]` **Player Enhancements**
  - `[ ]` Chapters and timestamps support
  - `[ ]` Subtitle (VTT) upload and processing
  - `[ ]` Playback speed and PiP controls
- `[ ]` **Analytics Engine**
  - `[ ]` Frontend: Player ping interval logic (10s heartbeats)
  - `[ ]` API: Ingest `/ping` route & Redis buffering
  - `[ ]` Worker: Scheduled flush from Redis to PostgreSQL
  - `[ ]` Dashboard: Analytics visualization (Recharts/Visx)

## Phase 5: Enterprise Scaling
- `[ ]` **Enterprise Features**
  - `[ ]` S3 dedicated integration for enterprise tenants
  - `[ ]` 4K Transcoding pipelines
  - `[ ]` Webhook dispatch system
  - `[ ]` API Keys for external integrations
  - `[ ]` DRM (Widevine/FairPlay) packaging (Optional)
