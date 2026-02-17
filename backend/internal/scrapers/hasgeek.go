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

type HasGeekScraper struct {
	*BaseScraper
	url string
}

func NewHasGeekScraper(timeout time.Duration, retries int) *HasGeekScraper {
	return &HasGeekScraper{
		BaseScraper: NewBaseScraper(timeout, retries),
		url:         "https://hasgeek.com",
	}
}

func (s *HasGeekScraper) Name() string { return "hasgeek" }

func (s *HasGeekScraper) Scrape(ctx context.Context) ([]models.Event, error) {
	resp, err := s.FetchWithRetry(ctx, s.url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	baseURL := "https://hasgeek.com"
	var events []models.Event

	// ✅ ONLY scrape inside: <ul class="mui-list--unstyled grid upcoming">
	// Do NOT scan whole page.
	doc.Find("ul.mui-list--unstyled.grid.upcoming > li[role='listitem']").Each(func(i int, li *goquery.Selection) {
		ev := s.parseUpcomingListItem(ctx, li, baseURL)
		if ev != nil {
			events = append(events, *ev)
		}
	})

	fmt.Printf("HasGeek: Found %d upcoming offline events\n", len(events))
	return events, nil
}

// Parses a single <li> within the Upcoming list only
func (s *HasGeekScraper) parseUpcomingListItem(ctx context.Context, li *goquery.Selection, baseURL string) *models.Event {
	a := li.Find("a.card.card--upcoming").First()
	if a.Length() == 0 {
		return nil
	}

	// Title
	title := strings.TrimSpace(a.AttrOr("aria-label", ""))
	if title == "" {
		title = strings.TrimSpace(a.Find(".card__image__tagline").First().Text())
	}
	if title == "" {
		title = strings.TrimSpace(a.Find("[data-cy-title]").First().AttrOr("data-cy-title", ""))
	}
	title = cleanSpaceHasGeek(title)
	if title == "" {
		return nil
	}

	// Website
	href := strings.TrimSpace(a.AttrOr("href", ""))
	if href == "" {
		return nil
	}
	website := href
	if !strings.HasPrefix(website, "http") {
		if strings.HasPrefix(website, "/") {
			website = baseURL + website
		} else {
			website = baseURL + "/" + website
		}
	}

	// Date + Location from: aria-label="21 Feb 2026, Bangalore"
	// (your snippet shows: <div aria-label="21 Feb 2026, Bangalore"> ... )
	ariaMeta := cleanSpaceHasGeek(a.Find("div[aria-label]").First().AttrOr("aria-label", ""))

	date := ""
	location := ""

	if ariaMeta != "" {
		parts := strings.SplitN(ariaMeta, ",", 2)
		date = strings.TrimSpace(parts[0])
		if len(parts) == 2 {
			location = strings.TrimSpace(parts[1])
		}
	}

	// Fallbacks (still only within this upcoming card/li)
	if date == "" {
		date = cleanSpaceHasGeek(a.Find("time").First().Text())
	}
	if location == "" {
		location = cleanSpaceHasGeek(a.Find(".location,.venue,[itemprop='location']").First().Text())
	}
	if location == "" {
		location = "N/A"
	}

	// Skip online/virtual
	if !utils.IsOfflineEvent("", location, title) {
		return nil
	}

	// Skip past events
	if date != "" && !utils.IsUpcoming(date) {
		return nil
	}

	return &models.Event{
		EventName: title,
		Location:  location,
		Address:   "",
		Date:      date,
		Website:   website,
		EventType: "Offline",
		Platform:  "hasgeek",
	}
}

// ✅ Unique name to avoid your "cleanSpace redeclared" error with meetup.go
func cleanSpaceHasGeek(s string) string {
	s = strings.ReplaceAll(s, "\u00a0", " ")
	return strings.Join(strings.Fields(s), " ")
}
