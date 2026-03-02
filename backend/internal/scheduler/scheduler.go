package scheduler

import (
	"context"
	"event-scraper/internal/ai"
	"event-scraper/internal/database"
	"event-scraper/internal/models"
	"event-scraper/internal/scrapers"
	"event-scraper/pkg/utils"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/lib/pq"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

// BatchCleaner interface for LLM event cleaning (Ollama only)
type BatchCleaner interface {
	CleanEventBatch(ctx context.Context, events []models.Event, details []*models.EventDetail) ([]ai.CleanedEvent, error)
}

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

	cleaner     BatchCleaner
	llmProvider string
}

type ScraperStatus struct {
	Name        string
	Success     bool
	EventsFound int
	Filtered    int
	Error       string
	Duration    time.Duration
}

func New(
	db *database.DB,
	logger *zap.Logger,
	intervalMinutes int,
	timeout time.Duration,
	retries int,
) *Scheduler {

	// Ollama is the sole LLM provider
	provider := "ollama"
	cleaner := BatchCleaner(ai.NewOllamaCleanerFromEnv())
	logger.Info("Ollama cleaner initialized",
		zap.String("provider", provider),
		zap.String("ollama_url", getEnv("OLLAMA_URL", "http://localhost:11434")),
		zap.String("ollama_model", getEnv("OLLAMA_MODEL", "gemma2:2b")),
	)

	allScrapers := []scrapers.Scraper{
		scrapers.NewAllEventsScraper(timeout, retries),
		scrapers.NewBIECScraper(timeout, retries),
		scrapers.NewHasGeekScraper(timeout, retries),
		scrapers.NewTownscriptScraper(timeout, retries),
		scrapers.NewMeetupScraper(timeout, retries),
		scrapers.NewEChaiScraper(timeout, retries),
		// HITEX is scraped by internal/scrapers/hitex.py — see runHitexPython()
	}

	return &Scheduler{
		db:              db,
		scrapers:        allScrapers,
		cron:            cron.New(),
		logger:          logger,
		stopChan:        make(chan struct{}),
		intervalMinutes: intervalMinutes,
		cleaner:         cleaner,
		llmProvider:     provider,
	}
}

func (s *Scheduler) Start() error {
	s.logger.Info("Starting event listing scheduler",
		zap.Int("interval_minutes", s.intervalMinutes),
		zap.Int("scraper_count", len(s.scrapers)),
		zap.String("filter", "upcoming + offline only"),
		zap.String("note", "Run cmd/detailscraper separately for event details"),
		zap.String("llm_provider", s.llmProvider),
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
	if s.isRunning {
		s.mu.Unlock()
		fmt.Println("Skipping cycle — previous still running")
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
	fmt.Printf("SCRAPING CYCLE #%d STARTED at %s\n", loop, start.Format("2006-01-02 15:04:05"))
	fmt.Printf("%s\n", strings.Repeat("=", 80))

	// 1) Run all Go scrapers
	for _, scraper := range s.scrapers {
		select {
		case <-s.stopChan:
			fmt.Println("Scheduler stopped mid-cycle")
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

	// 2) Run HITEX Python scraper
	hitexStatus := s.runHitexPython()
	statuses = append(statuses, hitexStatus)
	if hitexStatus.Success {
		totalInserted += hitexStatus.EventsFound
	}

	// 3) Clean events with selected LLM
	if s.cleaner != nil {
		s.cleanNewEvents()
	} else {
		fmt.Printf("\n⚠️  LLM cleaning skipped (LLM_PROVIDER=%s)\n", s.llmProvider)
	}

	// 4) Log results
	fmt.Printf("\n%s\n", strings.Repeat("=", 80))
	fmt.Printf("CYCLE #%d COMPLETED\n", loop)
	fmt.Printf("   Duration  : %v\n", time.Since(start).Round(time.Second))
	fmt.Printf("   Inserted  : %d events\n", totalInserted)
	fmt.Printf("   Filtered  : %d events\n", totalFiltered)
	fmt.Printf("%s\n", strings.Repeat("-", 80))

	for _, st := range statuses {
		icon := "[OK]"
		if !st.Success {
			icon = "[FAIL]"
		}
		fmt.Printf("  %s %-20s | inserted: %d", icon, st.Name, st.EventsFound)
		if st.Filtered > 0 {
			fmt.Printf(" | filtered: %d", st.Filtered)
		}
		if st.Error != "" {
			fmt.Printf(" | error: %s", st.Error)
		}
		fmt.Println()

		if err := s.db.RecordScraperRun(
			st.Name, st.Success, st.EventsFound, st.Filtered,
			st.Error, st.Duration.Seconds(),
		); err != nil {
			s.logger.Warn("Failed to record scraper health", zap.String("scraper", st.Name), zap.Error(err))
		}
	}
	fmt.Printf("%s\n\n", strings.Repeat("=", 80))
}

func (s *Scheduler) cleanNewEvents() {
	s.logger.Info("Starting event cleaning phase", zap.String("llm_provider", s.llmProvider))

	rows, err := s.db.GetConn().Query(`
		SELECT 
			e.id, 
			e.event_name, 
			COALESCE(e.date, '') as date,
			COALESCE(e.time, '') as time,
			COALESCE(e.location, '') as location,
			COALESCE(e.address, '') as address,
			COALESCE(e.description, '') as description,
			COALESCE(e.platform, '') as platform,
			COALESCE(e.website, '') as website,
			COALESCE(ed.full_description, '') as full_description
		FROM events e
		LEFT JOIN event_details ed ON e.id = ed.event_id
		LEFT JOIN event_cleaned ec ON e.id = ec.event_id
		WHERE ec.event_id IS NULL 
		   OR ec.cleaned_at < NOW() - INTERVAL '7 days'
		ORDER BY e.created_at DESC
		LIMIT 5
	`)
	if err != nil {
		s.logger.Error("Failed to fetch events for cleaning", zap.Error(err))
		return
	}
	defer rows.Close()

	var events []models.Event
	var details []*models.EventDetail
	var eventIDs []int64

	for rows.Next() {
		var e models.Event
		var fullDesc string

		err := rows.Scan(
			&e.ID, &e.EventName, &e.Date, &e.Time, &e.Location, &e.Address,
			&e.Description, &e.Platform, &e.Website,
			&fullDesc,
		)
		if err != nil {
			s.logger.Error("Error scanning event", zap.Error(err))
			continue
		}

		events = append(events, e)
		eventIDs = append(eventIDs, e.ID)

		detail := &models.EventDetail{
			EventID:         e.ID,
			FullDescription: fullDesc,
		}
		details = append(details, detail)
	}

	if len(events) == 0 {
		s.logger.Info("No events need cleaning")
		return
	}

	s.logger.Info("Cleaning events",
		zap.Int("count", len(events)),
		zap.String("llm_provider", s.llmProvider),
	)

	cleaned, err := s.cleaner.CleanEventBatch(context.Background(), events, details)
	if err != nil {
		s.logger.Error("Batch cleaning failed", zap.Error(err), zap.String("llm_provider", s.llmProvider))
		return
	}

	savedCount := 0
	for i, clean := range cleaned {
		if i >= len(eventIDs) {
			break
		}

		_, err := s.db.GetConn().Exec(`
			INSERT INTO event_cleaned (
				event_id, title_clean, description_clean, date_clean, time_clean,
				location_clean, address_clean, tech_stack, speakers, organizer,
				price, confidence, missing_data, summary, highlights, cleaned_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
			ON CONFLICT (event_id) DO UPDATE SET
				title_clean = EXCLUDED.title_clean,
				description_clean = EXCLUDED.description_clean,
				date_clean = EXCLUDED.date_clean,
				time_clean = EXCLUDED.time_clean,
				location_clean = EXCLUDED.location_clean,
				address_clean = EXCLUDED.address_clean,
				tech_stack = EXCLUDED.tech_stack,
				speakers = EXCLUDED.speakers,
				organizer = EXCLUDED.organizer,
				price = EXCLUDED.price,
				confidence = EXCLUDED.confidence,
				missing_data = EXCLUDED.missing_data,
				summary = EXCLUDED.summary,
				highlights = EXCLUDED.highlights,
				cleaned_at = NOW()
		`,
			eventIDs[i],
			clean.Title,
			clean.Description,
			clean.Date,
			clean.Time,
			clean.Location,
			clean.Address,
			pq.Array(clean.TechStack),
			pq.Array(clean.Speakers),
			clean.Organizer,
			clean.Price,
			clean.Confidence,
			pq.Array(clean.MissingData),
			clean.Summary,
			pq.Array(clean.Highlights),
		)

		if err != nil {
			s.logger.Error("Failed to save cleaned event",
				zap.Int64("event_id", eventIDs[i]),
				zap.Error(err))
		} else {
			savedCount++
		}
	}

	fmt.Printf("\n✅ LLM cleaning complete (%s): %d events cleaned\n", s.llmProvider, savedCount)
}

func hitexScriptPath() string {
	if cwd, err := os.Getwd(); err == nil {
		return filepath.Join(cwd, "internal", "scrapers", "hitex.py")
	}

	_, filename, _, ok := runtime.Caller(0)
	if ok {
		schedulerDir := filepath.Dir(filename)
		internalDir := filepath.Dir(schedulerDir)
		abs, _ := filepath.Abs(filepath.Join(internalDir, "scrapers", "hitex.py"))
		return abs
	}

	return filepath.Join("internal", "scrapers", "hitex.py")
}

func pythonExecutable() string {
	if runtime.GOOS == "windows" {
		return "python"
	}
	return "python3"
}

func (s *Scheduler) runHitexPython() ScraperStatus {
	scriptPath := hitexScriptPath()
	fmt.Printf("  [HITEX Python] %s\n", scriptPath)
	runStart := time.Now()

	if _, err := os.Stat(scriptPath); err != nil {
		msg := fmt.Sprintf("hitex.py not found at: %s", scriptPath)
		fmt.Println(" ", msg)
		s.logger.Error("HITEX Python scraper not found", zap.String("expected_path", scriptPath))
		return ScraperStatus{Name: "hitex (python)", Error: msg, Duration: time.Since(runStart)}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, pythonExecutable(), scriptPath)
	cmd.Env = append(os.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
	)

	output, err := cmd.CombinedOutput()
	outputStr := strings.TrimSpace(string(output))

	for _, line := range strings.Split(outputStr, "\n") {
		line = strings.TrimRight(line, "\r")
		if line != "" {
			fmt.Println("  [hitex-py]", line)
		}
	}

	if err != nil {
		s.logger.Error("HITEX Python scraper failed",
			zap.Error(err),
			zap.String("output", outputStr),
		)
		return ScraperStatus{Name: "hitex (python)", Error: err.Error(), Duration: time.Since(runStart)}
	}

	inserted := 0
	for _, line := range strings.Split(outputStr, "\n") {
		var n int
		if _, scanErr := fmt.Sscanf(strings.TrimSpace(line), "[DB]    Inserted: %d", &n); scanErr == nil {
			inserted = n
			break
		}
	}

	return ScraperStatus{Name: "hitex (python)", Success: true, EventsFound: inserted, Duration: time.Since(runStart)}
}

func (s *Scheduler) runScraper(scraper scrapers.Scraper) ScraperStatus {
	name := scraper.Name()
	runStart := time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	events, err := scraper.Scrape(ctx)
	if err != nil {
		s.logger.Error("Scraper failed", zap.String("scraper", name), zap.Error(err))
		return ScraperStatus{Name: name, Error: err.Error(), Duration: time.Since(runStart)}
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
			return ScraperStatus{Name: name, Error: err.Error(), Filtered: filtered, Duration: time.Since(runStart)}
		}
		inserted = i
	}

	return ScraperStatus{
		Name:        name,
		Success:     true,
		EventsFound: inserted,
		Filtered:    filtered,
		Duration:    time.Since(runStart),
	}
}

func (s *Scheduler) GetLoopCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loopCount
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}