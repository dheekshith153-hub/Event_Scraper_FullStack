package scrapers

import (
	"context"
	"event-scraper/internal/models"
	"fmt"
	"net/http"
	"time"
)

// Scraper interface that all scrapers must implement
type Scraper interface {
	Name() string
	Scrape(ctx context.Context) ([]models.Event, error)
}

// BaseScraper provides common functionality for all scrapers
type BaseScraper struct {
	client  *http.Client
	timeout time.Duration
	retries int
}

func NewBaseScraper(timeout time.Duration, retries int) *BaseScraper {
	return &BaseScraper{
		client: &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		timeout: timeout,
		retries: retries,
	}
}

// FetchWithRetry fetches a URL with retry logic
func (b *BaseScraper) FetchWithRetry(ctx context.Context, url string) (*http.Response, error) {
	var lastErr error

	for i := 0; i < b.retries; i++ {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")

		resp, err := b.client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			return resp, nil
		}

		if resp != nil {
			if err == nil {
				lastErr = fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
			}
			resp.Body.Close()
		}

		if err != nil {
			lastErr = err
		}
		if i < b.retries-1 {
			time.Sleep(time.Duration(i+1) * 2 * time.Second)
		}
	}

	return nil, fmt.Errorf("failed after %d retries: %w", b.retries, lastErr)
}
