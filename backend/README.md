# Event Scraper - Multi-Platform Event Aggregator

A production-ready event scraping application built with Go that collects events from multiple platforms and stores them in PostgreSQL with automatic duplicate detection.

## Features

- ✅ **Multi-Platform Support**: Scrapes from 7 different platforms
  - AllEvents.in (API-based)
  - BIEC (HTML scraping)
  - HasGeek (HTML scraping)
  - Townscript (JavaScript rendering)
  - Meetup.com (JavaScript rendering)
  - HITEX (HTML scraping with tech filtering)
  - eChai Ventures (HTML scraping)

- ✅ **Robust Architecture**
  - PostgreSQL database with proper indexing
  - Automatic duplicate detection using hash-based deduplication
  - Retry logic with exponential backoff
  - Concurrent scraping with rate limiting
  - Structured logging with Zap
  - Scheduled execution every N minutes

- ✅ **Production Ready**
  - Graceful shutdown handling
  - Error recovery and retry mechanisms
  - Database connection pooling
  - Comprehensive logging
  - Statistics tracking

## Prerequisites

- Go 1.21 or higher
- PostgreSQL 12 or higher
- Chrome/Chromium (for JavaScript rendering)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd event-scraper
```

### 2. Install Go dependencies

```bash
go mod download
```

### 3. Set up PostgreSQL

```bash
# Create database
createdb event_scraper

# Or using psql
psql -U postgres -c "CREATE DATABASE event_scraper;"
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=event_scraper
DB_SSLMODE=disable

# Scraper Configuration
SCRAPER_INTERVAL_MINUTES=10
SCRAPER_TIMEOUT_SECONDS=120
MAX_RETRIES=3

# Logging
LOG_LEVEL=info
LOG_FILE=logs/scraper.log

# Rate Limiting
RATE_LIMIT_DELAY_SECONDS=2
```

## Usage

### Run the application

```bash
go run cmd/scraper/main.go
```

### Build and run

```bash
# Build
go build -o event-scraper cmd/scraper/main.go

# Run
./event-scraper
```

### Build for production

```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o event-scraper-linux cmd/scraper/main.go

# Windows
GOOS=windows GOARCH=amd64 go build -o event-scraper.exe cmd/scraper/main.go

# macOS
GOOS=darwin GOARCH=amd64 go build -o event-scraper-mac cmd/scraper/main.go
```

## Project Structure

```
event-scraper/
├── cmd/
│   └── scraper/
│       └── main.go              # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go            # Configuration management
│   ├── database/
│   │   ├── db.go                # Database operations
│   │   └── migrations.go        # Database schema
│   ├── models/
│   │   └── event.go             # Event data model
│   ├── scrapers/
│   │   ├── base.go              # Base scraper interface
│   │   ├── allevents.go         # AllEvents scraper
│   │   ├── biec.go              # BIEC scraper
│   │   ├── hasgeek.go           # HasGeek scraper
│   │   ├── townscript.go        # Townscript scraper
│   │   ├── meetup.go            # Meetup scraper
│   │   ├── hitex.go             # HITEX scraper
│   │   └── echai.go             # eChai scraper
│   └── scheduler/
│       └── scheduler.go         # Scheduling logic
├── pkg/
│   └── utils/
│       ├── dedup.go             # Deduplication utilities
│       └── logger.go            # Logger setup
├── go.mod
├── go.sum
├── .env.example
└── README.md
```

## Database Schema

```sql
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(500) NOT NULL,
    location VARCHAR(500),
    date_time VARCHAR(200),
    date VARCHAR(100),
    time VARCHAR(100),
    website VARCHAR(1000),
    description TEXT,
    event_type VARCHAR(50),        -- Online/Offline
    platform VARCHAR(50) NOT NULL,  -- Source platform
    hash VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_platform ON events(platform);
CREATE INDEX idx_events_hash ON events(hash);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_event_type ON events(event_type);
```

## How It Works

### 1. Scraping Cycle

Every N minutes (configurable), the scheduler:
1. Runs all scrapers concurrently
2. Each scraper fetches events from its platform
3. Events are normalized and deduplicated
4. Events are inserted into PostgreSQL

### 2. Duplicate Detection

Events are deduplicated using:
- SHA256 hash of: `event_name + location + date`
- Database UNIQUE constraint on hash column
- ON CONFLICT DO UPDATE for existing events

### 3. Scraping Strategies

**API-Based (AllEvents.in)**
- Direct API calls with proper headers
- Session priming with Playwright/Chromedp
- Pagination support

**HTML Scraping (BIEC, HasGeek, HITEX, eChai)**
- HTTP requests + goquery parsing
- Multiple selector fallbacks
- Robust error handling

**JavaScript Rendering (Townscript, Meetup)**
- Chromedp for browser automation
- Parse Next.js data and JSON-LD
- Handles dynamic content loading

## Monitoring

### View Statistics

Connect to PostgreSQL and run:

```sql
-- Total events
SELECT COUNT(*) FROM events;

-- Events by platform
SELECT platform, COUNT(*) as count 
FROM events 
GROUP BY platform 
ORDER BY count DESC;

-- Events by type
SELECT event_type, COUNT(*) as count 
FROM events 
GROUP BY event_type;

-- Recent events
SELECT event_name, platform, location, date, created_at 
FROM events 
ORDER BY created_at DESC 
LIMIT 10;
```

### Logs

Logs are written to:
- Console (stdout)
- File: `logs/scraper.log` (JSON format)

## Troubleshooting

### Database connection failed
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U postgres -h localhost -d event_scraper
```

### Chromedp errors
```bash
# Install Chrome/Chromium
sudo apt-get install chromium-browser

# Or on macOS
brew install chromium
```

### Rate limiting (429 errors)
- Increase `RATE_LIMIT_DELAY_SECONDS` in `.env`
- Reduce scraping frequency

### Website structure changed
- Check logs for specific scraper errors
- Update selectors in respective scraper file
- Test with: `go run cmd/scraper/main.go`

## Performance

- **Memory**: ~100-200 MB per scraping cycle
- **Duration**: 5-10 minutes per complete cycle (all platforms)
- **Database**: ~1000-5000 events typical storage

## Extending

### Adding a New Scraper

1. Create new file in `internal/scrapers/`:

```go
package scrapers

import (
    "context"
    "event-scraper/internal/models"
    "time"
)

type NewScraper struct {
    *BaseScraper
}

func NewNewScraper(timeout time.Duration, retries int) *NewScraper {
    return &NewScraper{
        BaseScraper: NewBaseScraper(timeout, retries),
    }
}

func (s *NewScraper) Name() string {
    return "newsource"
}

func (s *NewScraper) Scrape(ctx context.Context) ([]models.Event, error) {
    // Implement scraping logic
    return events, nil
}
```

2. Register in `internal/scheduler/scheduler.go`:

```go
allScrapers := []scrapers.Scraper{
    // ... existing scrapers ...
    scrapers.NewNewScraper(timeout, retries),
}
```

## License

MIT

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Support

For issues and questions:
- Create an issue on GitHub
- Check logs in `logs/scraper.log`
- Review database for data integrity

## Acknowledgments

- Built with Go, PostgreSQL, goquery, chromedp
- Inspired by the need for centralized event aggregation
