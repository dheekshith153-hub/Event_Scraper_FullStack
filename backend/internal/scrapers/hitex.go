package scrapers

import (
	"context"
	"event-scraper/internal/models"
	"event-scraper/pkg/utils"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

type HITEXScraper struct {
	*BaseScraper
	url string
}

func NewHITEXScraper(timeout time.Duration, retries int) *HITEXScraper {
	return &HITEXScraper{
		BaseScraper: NewBaseScraper(timeout, retries),
		url:         "https://hitex.co.in/events/upcoming.html",
	}
}

func (s *HITEXScraper) Name() string {
	return "hitex"
}

func (s *HITEXScraper) Scrape(ctx context.Context) ([]models.Event, error) {
	resp, err := s.FetchWithRetry(ctx, s.url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch HITEX: %w", err)
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	var events []models.Event

	// HITEX uses h3 headings with links for each event, followed by date and organizer info
	doc.Find("h3").Each(func(i int, heading *goquery.Selection) {
		link := heading.Find("a")
		if link.Length() == 0 {
			return
		}

		title := strings.TrimSpace(link.Text())
		if title == "" || len(title) < 3 {
			return
		}

		// Skip navigation/non-event headings
		if title == "Upcoming Events" || title == "Footer" {
			return
		}

		href, exists := link.Attr("href")
		website := ""
		if exists {
			if strings.HasPrefix(href, "http") {
				website = href
			} else if strings.HasPrefix(href, "/") {
				website = "https://hitex.co.in" + href
			}
		}

		// Extract date from surrounding content
		// HITEX dates appear after the h3, in format like "17 Feb 2026 - 18 Feb 2026"
		date := ""
		parent := heading.Parent()
		if parent.Length() > 0 {
			// Look for date text (day month year format)
			fullText := strings.TrimSpace(parent.Text())
			dateRegex := regexp.MustCompile(`(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})`)
			matches := dateRegex.FindStringSubmatch(fullText)
			if len(matches) >= 4 {
				date = fmt.Sprintf("%s %s %s", matches[1], matches[2], matches[3])
			}
		}

		// Also try sibling elements for date
		if date == "" {
			next := heading.Next()
			for next.Length() > 0 {
				text := strings.TrimSpace(next.Text())
				dateRegex := regexp.MustCompile(`(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})`)
				matches := dateRegex.FindStringSubmatch(text)
				if len(matches) >= 4 {
					date = fmt.Sprintf("%s %s %s", matches[1], matches[2], matches[3])
					break
				}
				next = next.Next()
			}
		}

		// Skip past events
		if !utils.IsUpcoming(date) {
			return
		}

		// Skip online/virtual events (HITEX is a physical venue, so almost all are offline)
		if !utils.IsOfflineEvent("Offline", "HITEX Exhibition Centre, Hyderabad", title) {
			return
		}

		// Extract organizer if available
		organizer := ""
		if orgLink := parent.Find("a[href*='organizer']"); orgLink.Length() > 0 {
			organizer = strings.TrimSpace(orgLink.Text())
		}

		description := ""
		if organizer != "" {
			description = fmt.Sprintf("Organized by: %s", organizer)
		}

		location := "HITEX Exhibition Centre, Hyderabad"
		address := "Off Izzat Nagar, Kondapur, Hyderabad, Telangana 500084, India"

		event := models.Event{
			EventName:   title,
			Location:    location,
			Address:     address,
			Date:        date,
			Website:     website,
			Description: description,
			EventType:   "Offline",
			Platform:    "hitex",
		}

		events = append(events, event)
	})

	fmt.Printf("HITEX: Found %d upcoming offline events\n", len(events))
	return events, nil
}
