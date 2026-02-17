# Quick Start Guide

Get the Event Scraper running in 5 minutes!

## Prerequisites

- Go 1.21+
- PostgreSQL 12+
- (Optional) Docker & Docker Compose

## Option 1: Local Setup (Recommended for Development)

### Step 1: Setup Database

```bash
# Create PostgreSQL database
createdb event_scraper

# Or with specific user
createdb -U postgres event_scraper
```

### Step 2: Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit .env with your database credentials
nano .env
```

Minimal configuration:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=event_scraper
SCRAPER_INTERVAL_MINUTES=10
```

### Step 3: Install Dependencies

```bash
go mod download
```

### Step 4: Run

```bash
# Run directly
go run cmd/scraper/main.go

# Or build and run
go build -o event-scraper cmd/scraper/main.go
./event-scraper
```

## Option 2: Docker (Recommended for Production)

```bash
# Start everything with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f scraper

# Stop
docker-compose down
```

## Option 3: Automated Setup Script

```bash
# Run the setup script
chmod +x setup.sh
./setup.sh
```

The script will:
- Check prerequisites
- Install dependencies
- Create .env file
- Setup database
- Build the application

## Verification

### Check if it's running

You should see output like:
```
╔══════════════════════════════════════════════════════════════╗
║           🎯  EVENT SCRAPER APPLICATION  🎯                  ║
╚══════════════════════════════════════════════════════════════╝

🚀 Event Scraper is running!
📅 Scraping every 10 minutes
🛑 Press Ctrl+C to stop
```

### Check Database

```bash
# Connect to database
psql -U postgres -d event_scraper

# View events
SELECT COUNT(*) FROM events;
SELECT platform, COUNT(*) as count FROM events GROUP BY platform;
```

### Check Logs

```bash
# View real-time logs
tail -f logs/scraper.log

# Or with make
make logs
```

## What Happens Next?

1. **Immediate Scraping**: The scraper runs immediately on startup
2. **Periodic Scraping**: Automatically repeats every N minutes (default: 10)
3. **Data Storage**: Events are saved to PostgreSQL with duplicate detection
4. **Statistics**: View stats in console and database

## Expected First Run

On first run, you should see:
- ✅ 7 scrapers executing
- ✅ Hundreds to thousands of events discovered
- ✅ Events stored in database
- ⏱️ Takes 5-10 minutes for complete cycle

## Troubleshooting

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U postgres -h localhost
```

### "Chromedp error"
```bash
# Install Chrome/Chromium
# Ubuntu/Debian
sudo apt-get install chromium-browser

# macOS
brew install chromium
```

### "Rate limited (429)"
- Wait a few minutes
- Increase `RATE_LIMIT_DELAY_SECONDS` in .env

## Useful Commands

```bash
# Using Make
make run          # Run application
make build        # Build binary
make db-reset     # Reset database
make logs         # View logs
make help         # Show all commands

# Manual
go run cmd/scraper/main.go    # Run
go build cmd/scraper/main.go  # Build
./event-scraper               # Execute
```

## Stopping the Application

Press `Ctrl+C` for graceful shutdown:
- Completes current scraping cycle
- Saves all data
- Closes database connections
- Displays summary statistics

## Next Steps

1. **Monitor Logs**: Watch `logs/scraper.log` for details
2. **Query Database**: Explore events in PostgreSQL
3. **Customize**: Adjust interval, add scrapers, modify filters
4. **Deploy**: Use Docker for production deployment

## Need Help?

- Check README.md for detailed documentation
- Review logs for error messages
- Check database for data integrity
- Open an issue on GitHub

---

**Happy Scraping! 🎯**
