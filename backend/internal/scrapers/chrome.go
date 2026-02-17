package scrapers

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/chromedp/chromedp"
)

// knownBenignErrors contains substrings of CDP errors that are harmless
// and should be silently dropped rather than logged.
var knownBenignErrors = []string{
	"could not unmarshal event",
	"cookiePart",
	"PrivateNetworkRequestPolicy",
	"unhandled page event",
}

// isBenignCDPError checks if a log message is a known benign CDP error.
func isBenignCDPError(msg string) bool {
	for _, pattern := range knownBenignErrors {
		if strings.Contains(msg, pattern) {
			return true
		}
	}
	return false
}

// NewChromeContext creates a chromedp context with proper options that suppress
// known benign CDP unmarshal errors. The caller must call the returned cancel
// function when done.
func NewChromeContext(parent context.Context) (context.Context, context.CancelFunc) {
	// Create allocator with headless Chrome options
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.Flag("disable-features", "PrivateNetworkAccessPermissionPrompt"),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-setuid-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-web-security", true),
		chromedp.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(parent, opts...)

	// Create browser context with error logging suppressed for known benign errors
	ctx, ctxCancel := chromedp.NewContext(allocCtx,
		chromedp.WithErrorf(filteredLogf),
		chromedp.WithLogf(filteredLogf),
	)

	// Combined cancel function
	cancel := func() {
		ctxCancel()
		allocCancel()
	}

	return ctx, cancel
}

// filteredLogf logs messages but silently drops known benign CDP errors.
func filteredLogf(format string, args ...interface{}) {
	// Build the full message to check against known patterns
	msg := fmt.Sprintf(format, args...)
	if isBenignCDPError(msg) {
		return
	}

	// Log non-benign messages normally
	log.Print(msg)
}
