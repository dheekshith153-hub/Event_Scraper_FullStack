package main

import (
	"context"
	"database/sql"
	"event-scraper/internal/config"
	"event-scraper/internal/scrapers"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"go.uber.org/zap"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("Failed to load config", zap.Error(err))
	}

	sqlDB, err := sql.Open("postgres", cfg.Database.ConnectionString())
	if err != nil {
		logger.Fatal("Failed to open database", zap.Error(err))
	}
	defer sqlDB.Close()

	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	if err := sqlDB.Ping(); err != nil {
		logger.Fatal("Database ping failed", zap.Error(err))
	}

	fmt.Println(strings.Repeat("=", 80))
	fmt.Println("🚀 EVENT DETAIL SCRAPER — Standalone Process")
	fmt.Println("   Runs every 30 minutes")
	fmt.Println("   Saves each event to DB immediately after scraping")
	fmt.Println("   Fully independent of the event listing scraper")
	fmt.Println(strings.Repeat("=", 80))

	detailScraper := scrapers.NewDetailScraper(sqlDB, 30*time.Second, 3)

	// Graceful shutdown on Ctrl+C
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Run immediately on startup
	runCycle(sqlDB, detailScraper, logger)

	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			fmt.Println("\n⛔ Detail scraper shutting down gracefully...")
			return
		case <-ticker.C:
			runCycle(sqlDB, detailScraper, logger)
		}
	}
}

func runCycle(sqlDB *sql.DB, detailScraper *scrapers.DetailScraper, logger *zap.Logger) {
	cycleStart := time.Now()

	fmt.Printf("\n%s\n", strings.Repeat("=", 80))
	fmt.Printf("🔍 Detail Scraper Cycle — %s\n", cycleStart.Format("2006-01-02 15:04:05"))
	fmt.Printf("%s\n", strings.Repeat("=", 80))

	// 60 min timeout — handles 400+ events with delays comfortably
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
	defer cancel()

	inserted := 0
	updated := 0
	failed := 0

	err := detailScraper.Scrape(ctx, func(detail scrapers.ScrapedDetail) error {
		isNew, err := insertOrUpdateEventDetail(sqlDB, detail)
		if err != nil {
			failed++
			logger.Error("DB save failed",
				zap.Int64("event_id", detail.EventID),
				zap.Error(err),
			)
			return err
		}

		if isNew {
			inserted++
			fmt.Printf("   ✅ NEW  event_id=%-6d | desc=%d chars | organizer=%s\n",
				detail.EventID, len(detail.FullDescription), detail.Organizer)
		} else {
			updated++
			fmt.Printf("   🔄 UPD  event_id=%-6d | desc=%d chars\n",
				detail.EventID, len(detail.FullDescription))
		}
		return nil
	})

	if err != nil && err != context.DeadlineExceeded {
		logger.Error("Detail scraper cycle error", zap.Error(err))
	}
	if err == context.DeadlineExceeded {
		fmt.Println("⚠️  Cycle hit 60min timeout — remaining events will be picked up next cycle")
	}

	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("📊 Cycle Summary — Duration: %v\n", time.Since(cycleStart).Round(time.Second))
	fmt.Printf("   ✅ New    : %d\n", inserted)
	fmt.Printf("   🔄 Updated: %d\n", updated)
	fmt.Printf("   ❌ Failed : %d\n", failed)
	fmt.Printf("   💾 Total  : %d saved to event_details\n", inserted+updated)
	fmt.Printf("%s\n\n", strings.Repeat("=", 80))
}

func insertOrUpdateEventDetail(db *sql.DB, detail scrapers.ScrapedDetail) (bool, error) {
	var exists bool
	err := db.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM event_details WHERE event_id = $1)",
		detail.EventID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("existence check failed: %w", err)
	}

	query := `
		INSERT INTO event_details (
			event_id, full_description, organizer, organizer_contact,
			image_url, tags, price, registration_url, duration,
			agenda_html, speakers_json, prerequisites,
			max_attendees, attendees_count, last_scraped, scraped_body
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9,
			$10, $11, $12, $13, $14, NOW(), $15
		)
		ON CONFLICT (event_id) DO UPDATE SET
			full_description  = EXCLUDED.full_description,
			organizer         = EXCLUDED.organizer,
			organizer_contact = EXCLUDED.organizer_contact,
			image_url         = EXCLUDED.image_url,
			tags              = EXCLUDED.tags,
			price             = EXCLUDED.price,
			registration_url  = EXCLUDED.registration_url,
			duration          = EXCLUDED.duration,
			agenda_html       = EXCLUDED.agenda_html,
			speakers_json     = EXCLUDED.speakers_json,
			prerequisites     = EXCLUDED.prerequisites,
			max_attendees     = EXCLUDED.max_attendees,
			attendees_count   = EXCLUDED.attendees_count,
			last_scraped      = NOW(),
			scraped_body      = EXCLUDED.scraped_body,
			updated_at        = NOW()
	`

	_, err = db.Exec(query,
		detail.EventID,
		detail.FullDescription,
		detail.Organizer,
		detail.OrganizerContact,
		detail.ImageURL,
		detail.Tags,
		detail.Price,
		detail.RegistrationURL,
		detail.Duration,
		detail.AgendaHTML,
		detail.SpeakersJSON,
		detail.Prerequisites,
		detail.MaxAttendees,
		detail.AttendeesCount,
		detail.ScrapedBody,
	)

	return !exists, err
}
