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
	isRunning       bool
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
	s.logger.Info("Starting event listing scheduler",
		zap.Int("interval_minutes", s.intervalMinutes),
		zap.Int("scraper_count", len(s.scrapers)),
		zap.String("filter", "upcoming + offline only"),
		zap.String("note", "Run cmd/detailscraper separately for event details"),
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
	// Prevent overlapping cycles
	s.mu.Lock()
	if s.isRunning {
		s.mu.Unlock()
		fmt.Println("⚠️  Skipping cycle — previous cycle still running")
		return
	}
	s.isRunning = true
	s.loopCount++
	loop := s.loopCount
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.isRunning = false
		s.mu.Unlock()
	}()

	start := time.Now()
	statuses := []ScraperStatus{}
	totalInserted := 0
	totalFiltered := 0

	fmt.Printf("\n%s\n", strings.Repeat("=", 80))
	fmt.Printf("🔄 SCRAPING CYCLE #%d STARTED at %s\n", loop, start.Format("2006-01-02 15:04:05"))
	fmt.Printf("%s\n", strings.Repeat("=", 80))

	// Scrape all event listing sources
	for _, scraper := range s.scrapers {
		select {
		case <-s.stopChan:
			fmt.Println("⚠️  Scheduler stopped mid-cycle")
			return
		default:
		}

		status := s.runScraper(scraper)
		statuses = append(statuses, status)
		if status.Success {
			totalInserted += status.EventsFound
			totalFiltered += status.Filtered
		}
	}

	// Summary
	fmt.Printf("\n%s\n", strings.Repeat("=", 80))
	fmt.Printf("✅ CYCLE #%d COMPLETED\n", loop)
	fmt.Printf("   Duration  : %v\n", time.Since(start).Round(time.Second))
	fmt.Printf("   Inserted  : %d events\n", totalInserted)
	fmt.Printf("   Filtered  : %d events\n", totalFiltered)
	fmt.Printf("%s\n", strings.Repeat("-", 80))

	for _, st := range statuses {
		icon := "✅"
		if !st.Success {
			icon = "❌"
		}
		fmt.Printf("  %s %-20s | inserted: %d", icon, st.Name, st.EventsFound)
		if st.Filtered > 0 {
			fmt.Printf(" | filtered: %d", st.Filtered)
		}
		if st.Error != "" {
			fmt.Printf(" | error: %s", st.Error)
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
		s.logger.Error("Scraper failed", zap.String("scraper", name), zap.Error(err))
		return ScraperStatus{Name: name, Error: err.Error()}
	}

	filtered := 0
	var cleanEvents []models.Event
	for _, event := range events {
		if !utils.IsOfflineEvent(event.EventType, event.Location, event.EventName) {
			filtered++
			continue
		}

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
			s.logger.Error("InsertBatch failed", zap.String("scraper", name), zap.Error(err))
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
