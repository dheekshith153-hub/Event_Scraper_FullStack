package scheduler

import (
	"context"
	"event-scraper/internal/database"
	"event-scraper/internal/models"
	"event-scraper/internal/scrapers"
	"event-scraper/pkg/utils"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

type Scheduler struct {
	db              *database.DB
	scrapers        []scrapers.Scraper
	cron            *cron.Cron
	logger          *zap.Logger
	loopCount       int
	mu              sync.Mutex
	stopChan        chan struct{}
	intervalMinutes int
}

type ScraperStatus struct {
	Name        string
	Success     bool
	EventsFound int
	Filtered    int
	Error       string
}

func New(
	db *database.DB,
	logger *zap.Logger,
	intervalMinutes int,
	timeout time.Duration,
	retries int,
) *Scheduler {

	allScrapers := []scrapers.Scraper{
		scrapers.NewAllEventsScraper(timeout, retries),
		scrapers.NewBIECScraper(timeout, retries),
		scrapers.NewHasGeekScraper(timeout, retries),
		scrapers.NewTownscriptScraper(timeout, retries),
		scrapers.NewMeetupScraper(timeout, retries),
		scrapers.NewHITEXScraper(timeout, retries),
		scrapers.NewEChaiScraper(timeout, retries),
	}

	return &Scheduler{
		db:              db,
		scrapers:        allScrapers,
		cron:            cron.New(),
		logger:          logger,
		stopChan:        make(chan struct{}),
		intervalMinutes: intervalMinutes,
	}
}

func (s *Scheduler) Start() error {
	s.logger.Info("Starting scheduler",
		zap.Int("interval_minutes", s.intervalMinutes),
		zap.Int("scraper_count", len(s.scrapers)),
		zap.String("filter", "upcoming + offline only"),
	)

	go s.runScrapingCycle()

	cronExpr := fmt.Sprintf("@every %dm", s.intervalMinutes)
	_, err := s.cron.AddFunc(cronExpr, s.runScrapingCycle)
	if err != nil {
		return err
	}

	s.cron.Start()
	return nil
}

func (s *Scheduler) Stop() {
	s.cron.Stop()
	close(s.stopChan)
}

func (s *Scheduler) runScrapingCycle() {
	s.mu.Lock()
	s.loopCount++
	loop := s.loopCount
	s.mu.Unlock()

	start := time.Now()
	statuses := []ScraperStatus{}

	totalEvents := 0

	for _, scraper := range s.scrapers {
		status := s.runScraper(scraper)
		statuses = append(statuses, status)
		if status.Success {
			totalEvents += status.EventsFound
		}
	}

	fmt.Printf("\n%s\n", strings.Repeat("=", 80))
	fmt.Printf("SCRAPING CYCLE #%d COMPLETED\n", loop)
	fmt.Printf("Duration: %v\n", time.Since(start))
	fmt.Printf("Filter: UPCOMING + OFFLINE ONLY\n")
	fmt.Printf("Total Events Inserted: %d\n", totalEvents)
	fmt.Printf("%s\n", strings.Repeat("-", 80))

	for _, s := range statuses {
		icon := "✅"
		if !s.Success {
			icon = "❌"
		}
		fmt.Printf("%s %-15s | %d events inserted", icon, s.Name, s.EventsFound)
		if s.Filtered > 0 {
			fmt.Printf(" | %d filtered out", s.Filtered)
		}
		if s.Error != "" {
			fmt.Printf(" | %s", s.Error)
		}
		fmt.Println()
	}
	fmt.Printf("%s\n\n", strings.Repeat("=", 80))
}

func (s *Scheduler) runScraper(scraper scrapers.Scraper) ScraperStatus {
	name := scraper.Name()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	events, err := scraper.Scrape(ctx)
	if err != nil {
		return ScraperStatus{Name: name, Error: err.Error()}
	}

	// Safety filter: remove any remaining online/virtual or past events
	filtered := 0
	var cleanEvents []models.Event
	for _, event := range events {
		// Double-check: skip online events
		if !utils.IsOfflineEvent(event.EventType, event.Location, event.EventName) {
			filtered++
			continue
		}

		// Double-check: skip past events using all available date fields
		dateStr := event.DateTime
		if dateStr == "" {
			dateStr = event.Date
		}
		if !utils.IsUpcoming(dateStr) {
			filtered++
			continue
		}

		cleanEvents = append(cleanEvents, event)
	}

	inserted := 0
	if len(cleanEvents) > 0 {
		i, _, err := s.db.InsertBatch(cleanEvents)
		if err != nil {
			return ScraperStatus{Name: name, Error: err.Error(), Filtered: filtered}
		}
		inserted = i
	}

	return ScraperStatus{
		Name:        name,
		Success:     true,
		EventsFound: inserted,
		Filtered:    filtered,
	}
}

func (s *Scheduler) GetLoopCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loopCount
}