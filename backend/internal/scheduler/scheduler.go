package scheduler

import (
	"context"
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
	Duration    time.Duration
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

	// HITEX Python scraper
	hitexStatus := s.runHitexPython()
	statuses = append(statuses, hitexStatus)
	if hitexStatus.Success {
		totalInserted += hitexStatus.EventsFound
	}

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

		// Record scraper health to DB
		if err := s.db.RecordScraperRun(
			st.Name, st.Success, st.EventsFound, st.Filtered,
			st.Error, st.Duration.Seconds(),
		); err != nil {
			s.logger.Warn("Failed to record scraper health", zap.String("scraper", st.Name), zap.Error(err))
		}
	}
	fmt.Printf("%s\n\n", strings.Repeat("=", 80))
}

// hitexScriptPath returns the absolute path to internal/scrapers/hitex.py.
// Always resolves from CWD (which is backend/ when running "go run cmd/scraper/main.go").
func hitexScriptPath() string {
	// Strategy 1: CWD — reliable when "go run" is executed from backend/
	if cwd, err := os.Getwd(); err == nil {
		return filepath.Join(cwd, "internal", "scrapers", "hitex.py")
	}

	// Strategy 2: relative to this source file
	// scheduler.go = backend/internal/scheduler/scheduler.go
	// hitex.py     = backend/internal/scrapers/hitex.py
	_, filename, _, ok := runtime.Caller(0)
	if ok {
		schedulerDir := filepath.Dir(filename)
		internalDir  := filepath.Dir(schedulerDir)
		abs, _        := filepath.Abs(filepath.Join(internalDir, "scrapers", "hitex.py"))
		return abs
	}

	return filepath.Join("internal", "scrapers", "hitex.py")
}

// pythonExecutable returns "python" on Windows, "python3" on Unix/Mac.
func pythonExecutable() string {
	if runtime.GOOS == "windows" {
		return "python"
	}
	return "python3"
}

// runHitexPython runs internal/scrapers/hitex.py as a subprocess.
// Sets PYTHONIOENCODING=utf-8 so Windows cp1252 doesn't cause UnicodeEncodeError.
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

	// ── Critical for Windows: force UTF-8 output encoding ────────────────────
	// Without this, Python on Windows uses cp1252 and crashes on any unicode char.
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

	// Parse "Inserted: N" from Python output
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