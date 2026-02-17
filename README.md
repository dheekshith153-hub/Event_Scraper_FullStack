# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
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
