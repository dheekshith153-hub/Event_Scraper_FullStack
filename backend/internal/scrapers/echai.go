package scrapers

import (
	"context"
	"event-scraper/internal/models"
	"event-scraper/pkg/utils"
	"fmt"
	"strings"
	"time"
	"github.com/PuerkitoBio/goquery"
)

type EChaiScraper struct {
	*BaseScraper
	url string
}

func NewEChaiScraper(timeout time.Duration, retries int) *EChaiScraper {
	return &EChaiScraper{
		BaseScraper: NewBaseScraper(timeout, retries),
		url:         "https://echai.ventures/events",
	}
}

func (s *EChaiScraper) Name() string {
	return "echai"
}

func (s *EChaiScraper) Scrape(ctx context.Context) ([]models.Event, error) {
	resp, err := s.FetchWithRetry(ctx, s.url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch eChai: %w", err)
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	var events []models.Event
	baseURL := "https://echai.ventures"

	// Find event containers
	doc.Find("div.position-relative.border-bottom.pb-1").Each(func(i int, container *goquery.Selection) {
		// Extract title
		title := ""
		if titleTag := container.Find("h6.event-title"); titleTag.Length() > 0 {
			title = strings.TrimSpace(titleTag.Text())
		}

		if title == "" {
			return
		}

		// Extract date (from data-date attribute)
		rawDate, exists := container.Attr("data-date")
		date := ""
		if exists && rawDate != "" {
			// Format: 2026-01-01T10:00:00Z -> 2026-01-01
			parts := strings.Split(rawDate, "T")
			if len(parts) > 0 {
				date = parts[0]
			}
		}

		// Skip past events
		if !utils.IsUpcoming(date) {
			return
		}

		// Extract link
		website := ""
		if linkTag := container.Find("a.stretched-link"); linkTag.Length() > 0 {
			if href, exists := linkTag.Attr("href"); exists {
				if strings.HasPrefix(href, "/") {
					website = baseURL + href
				} else if strings.HasPrefix(href, "http") {
					website = href
				} else {
					website = baseURL + "/" + href
				}
			}
		}

		// Extract location
		location := ""
		address := ""
		// Look for geography icon and get parent's text
		if geoIcon := container.Find("svg.bi-geo"); geoIcon.Length() > 0 {
			if parent := geoIcon.Parent(); parent.Length() > 0 {
				location = strings.TrimSpace(parent.Text())
			}
		}

		// If no location found, try alternative selectors
		if location == "" {
			if locElem := container.Find("[class*='location'], [class*='venue']"); locElem.Length() > 0 {
				location = strings.TrimSpace(locElem.Text())
			}
		}

		if location == "" {
			location = "N/A"
		}

		// Determine event type and skip online events
		eventType := "Offline"
		if strings.Contains(strings.ToLower(location), "online") ||
			strings.Contains(strings.ToLower(title), "online") {
			eventType = "Online"
		}

		// Skip online/virtual events
		if !utils.IsOfflineEvent(eventType, location, title) {
			return
		}

		event := models.Event{
			EventName: title,
			Date:      date,
			Location:  location,
			Address:   address,
			Website:   website,
			EventType: "Offline",
			Platform:  "echai",
		}

		events = append(events, event)
	})

	fmt.Printf("eChai: Found %d upcoming offline events\n", len(events))
	return events, nil
}
