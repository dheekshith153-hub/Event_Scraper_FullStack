// Package scrapers provides a Go bridge to the Python scraper implementations.
// All actual scraping is done in Python; this package provides the Go types and
// interfaces needed by the scheduler, server, and detail scraper commands.
package scrapers

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"event-scraper/internal/models"
)

// ─── Scraper Interface ────────────────────────────────────────────────────────

type Scraper interface {
	Name() string
	Scrape(ctx context.Context) ([]models.Event, error)
}

// ─── Python Subprocess Scraper ────────────────────────────────────────────────

type PythonScraper struct {
	name    string
	timeout time.Duration
}

func NewPythonScraper(timeout time.Duration) *PythonScraper {
	return &PythonScraper{name: "python-scrapers", timeout: timeout}
}

func (p *PythonScraper) Name() string {
	return p.name
}

func (p *PythonScraper) Scrape(ctx context.Context) ([]models.Event, error) {
	scriptPath := scraperScriptPath("main_scraper.py")
	fmt.Printf("  [PythonScraper] Running %s\n", scriptPath)

	if _, err := os.Stat(scriptPath); err != nil {
		return nil, fmt.Errorf("main_scraper.py not found at: %s", scriptPath)
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	cmd := exec.CommandContext(timeoutCtx, pythonExe(), "-u", scriptPath)
	cmd.Env = append(os.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
	)

	output, err := cmd.CombinedOutput()
	outputStr := strings.TrimSpace(string(output))

	for _, line := range strings.Split(outputStr, "\n") {
		line = strings.TrimRight(line, "\r")
		if line != "" {
			fmt.Println("  [python]", line)
		}
	}

	if err != nil {
		return nil, fmt.Errorf("python scraper failed: %w", err)
	}

	return nil, nil
}

// ─── Stub constructors (satisfy old scheduler imports) ────────────────────────

func NewAllEventsScraper(_ time.Duration, _ int) Scraper {
	return &noopScraper{name: "allevents"}
}
func NewBIECScraper(_ time.Duration, _ int) Scraper {
	return &noopScraper{name: "biec"}
}
func NewHasGeekScraper(_ time.Duration, _ int) Scraper {
	return &noopScraper{name: "hasgeek"}
}
func NewTownscriptScraper(_ time.Duration, _ int) Scraper {
	return &noopScraper{name: "townscript"}
}
func NewMeetupScraper(_ time.Duration, _ int) Scraper {
	return &noopScraper{name: "meetup"}
}
func NewEChaiScraper(_ time.Duration, _ int) Scraper {
	return &noopScraper{name: "echai"}
}

type noopScraper struct {
	name string
}

func (n *noopScraper) Name() string { return n.name }
func (n *noopScraper) Scrape(_ context.Context) ([]models.Event, error) {
	fmt.Printf("  [%s] NOTE: This scraper is now Python-based. Run main_scraper.py instead.\n", n.name)
	return nil, nil
}

// ─── ScrapedDetail ────────────────────────────────────────────────────────────

type ScrapedDetail struct {
	EventID          int64
	FullDescription  string
	Organizer        string
	OrganizerContact string
	ImageURL         string
	Tags             string
	Price            string
	RegistrationURL  string
	Duration         string
	AgendaHTML       string
	SpeakersJSON     string
	Prerequisites    string
	MaxAttendees     int
	AttendeesCount   int
	ScrapedBody      string
}

// ─── DetailScraper ────────────────────────────────────────────────────────────

type DetailScraper struct {
	db      *sql.DB
	timeout time.Duration
	retries int
}

func NewDetailScraper(db *sql.DB, timeout time.Duration, retries int) *DetailScraper {
	return &DetailScraper{db: db, timeout: timeout, retries: retries}
}

// Scrape runs the Python detail scraper.
//
// FIX: The old code called callback(ScrapedDetail{EventID: 0, ...}) after
// Python finished. main.go then tried to INSERT event_id=0 into event_details,
// which violated the FK constraint (no event has id=0).
//
// Fix: Python saves directly to DB — we do NOT call the callback with a fake
// zero-id record. We only call it if Python itself somehow returns a valid id
// (which it currently doesn't). The callback is kept for interface compatibility.
func (d *DetailScraper) Scrape(ctx context.Context, callback func(ScrapedDetail) error) error {
	scriptPath := scraperScriptPath("main_detailscraper.py")
	fmt.Printf("  [DetailScraper] Running %s\n", scriptPath)

	if _, err := os.Stat(scriptPath); err != nil {
		return fmt.Errorf("main_detailscraper.py not found at: %s", scriptPath)
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 60*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(timeoutCtx, pythonExe(), "-u", scriptPath)
	cmd.Env = append(os.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
	)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err := cmd.Run()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return context.DeadlineExceeded
		}
		return fmt.Errorf("detail scraper failed: %w", err)
	}

	// ✅ FIX: Do NOT call callback(ScrapedDetail{EventID: 0, ...}) here.
	// That caused: "violates foreign key constraint event_details_event_id_fkey"
	// Python handles all DB saves internally — nothing to report back via callback.
	return nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func pythonExe() string {
	if runtime.GOOS == "windows" {
		return "python"
	}
	return "python3"
}

func scraperScriptPath(filename string) string {
	if cwd, err := os.Getwd(); err == nil {
		p := filepath.Join(cwd, "internal", "scrapers", filename)
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}

	_, thisFile, _, ok := runtime.Caller(0)
	if ok {
		dir := filepath.Dir(thisFile)
		p := filepath.Join(dir, filename)
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}

	return filepath.Join("internal", "scrapers", filename)
}