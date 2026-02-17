package scrapers

import (
	"context"
	"encoding/json"
	"event-scraper/internal/models"
	"event-scraper/pkg/utils"
	"fmt"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
)

type MeetupScraper struct {
	*BaseScraper
	cities []string
}

func NewMeetupScraper(timeout time.Duration, retries int) *MeetupScraper {
	return &MeetupScraper{
		BaseScraper: NewBaseScraper(timeout, retries),
		cities: []string{
			"Bangalore", "Mumbai", "Delhi", "Hyderabad",
			"Chennai", "Pune", "Kolkata",
		},
	}
}

func (s *MeetupScraper) Name() string { return "meetup" }

func (s *MeetupScraper) Scrape(ctx context.Context) ([]models.Event, error) {
	var allEvents []models.Event
	techCategoryID := "546"

	for _, city := range s.cities {
		// ✅ Use your UPDATED link format (in-person + datetime sort)
		cityCode := fmt.Sprintf("in--%s", city)
		findURL := fmt.Sprintf(
			"https://www.meetup.com/find/?source=EVENTS&eventType=inPerson&sortField=DATETIME&location=%s&categoryId=%s",
			cityCode, techCategoryID,
		)

		events, err := s.scrapeCity(ctx, findURL, city)
		if err != nil {
			fmt.Printf("Error scraping Meetup for %s: %v\n", city, err)
			continue
		}

		allEvents = append(allEvents, events...)
		time.Sleep(2 * time.Second)
	}

	fmt.Printf("Meetup: Found %d upcoming offline events\n", len(allEvents))
	return allEvents, nil
}

func (s *MeetupScraper) scrapeCity(ctx context.Context, url, city string) ([]models.Event, error) {
	allocCtx, cancel := NewChromeContext(ctx)
	defer cancel()

	// 1) fetch listing page html (find page)
	var htmlContent string
	if err := chromedp.Run(
		allocCtx,
		chromedp.Navigate(url),
		chromedp.Sleep(4*time.Second),
		chromedp.OuterHTML("html", &htmlContent),
	); err != nil {
		return nil, fmt.Errorf("failed to fetch meetup find page: %w", err)
	}

	// 2) parse events ONLY from structured data (NO fallback anchor text)
	events, err := s.parseListingHTML(htmlContent, city)
	if err != nil {
		return nil, err
	}

	// 3) Enrich location by visiting event page ONLY if missing / N/A
	for i := range events {
		if strings.TrimSpace(events[i].Website) == "" {
			continue
		}
		loc := strings.TrimSpace(events[i].Location)
		if loc != "" && loc != "N/A" {
			continue
		}

		venueLoc, venueAddr := s.enrichFromEventPage(allocCtx, events[i].Website)
		if venueLoc != "" {
			events[i].Location = venueLoc
		}
		if venueAddr != "" {
			events[i].Address = venueAddr
		}

		if strings.TrimSpace(events[i].Location) == "" {
			events[i].Location = "N/A"
		}
	}

	return dedupeMeetupByWebsite(events), nil
}

func (s *MeetupScraper) parseListingHTML(htmlContent, city string) ([]models.Event, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return nil, err
	}

	var out []models.Event
	seen := make(map[string]bool)

	doc.Find("script#__NEXT_DATA__").Each(func(_ int, script *goquery.Selection) {
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(script.Text()), &data); err != nil {
			return
		}

		props, _ := data["props"].(map[string]interface{})
		pageProps, _ := props["pageProps"].(map[string]interface{})
		if pageProps == nil {
			return
		}

		// Try the usual containers first
		if evts := extractMeetupEventsFromPageProps(pageProps, city); len(evts) > 0 {
			for _, e := range evts {
				key := strings.TrimSpace(e.Website)
				if key == "" {
					key = e.EventName + "|" + e.DateTime
				}
				if !seen[key] {
					seen[key] = true
					out = append(out, e)
				}
			}
			return
		}

		// ✅ Important: Many Meetup find pages store results only in Apollo cache
		if ap, ok := pageProps["__APOLLO_STATE__"].(map[string]interface{}); ok {
			evts := extractMeetupEventsFromApollo(ap, city)
			for _, e := range evts {
				key := strings.TrimSpace(e.Website)
				if key == "" {
					key = e.EventName + "|" + e.DateTime
				}
				if !seen[key] {
					seen[key] = true
					out = append(out, e)
				}
			}
		}
	})

	// ❌ DO NOT FALLBACK TO <a>.Text() — that’s what was polluting your columns
	return out, nil
}

func extractMeetupEventsFromPageProps(pageProps map[string]interface{}, city string) []models.Event {
	var eventsList []interface{}

	if evts, ok := pageProps["events"].([]interface{}); ok {
		eventsList = evts
	} else if sr, ok := pageProps["searchResults"].(map[string]interface{}); ok {
		if edges, ok := sr["edges"].([]interface{}); ok {
			eventsList = edges
		}
	}

	var out []models.Event
	for _, item := range eventsList {
		eventData := meetupNode(item)
		if eventData == nil {
			continue
		}

		if e, ok := meetupEventFromMap(eventData, city); ok {
			out = append(out, e)
		}
	}
	return out
}

func extractMeetupEventsFromApollo(apollo map[string]interface{}, city string) []models.Event {
	var out []models.Event

	for _, v := range apollo {
		m, ok := v.(map[string]interface{})
		if !ok || m == nil {
			continue
		}

		// Detect event-like objects
		typename, _ := m["__typename"].(string)
		if typename != "" && !strings.Contains(strings.ToLower(typename), "event") {
			continue
		}

		// Many event objects still have __typename omitted; look for key fields.
		// We consider it event-like if it has title/name + some URL field.
		title, _ := m["title"].(string)
		if title == "" {
			title, _ = m["name"].(string)
		}
		title = cleanSpaceMeetup(title)
		if title == "" {
			continue
		}

		eventURL := ""
		if s, _ := m["eventUrl"].(string); s != "" {
			eventURL = s
		} else if s, _ := m["link"].(string); s != "" {
			eventURL = s
		} else if s, _ := m["url"].(string); s != "" {
			eventURL = s
		}
		eventURL = normalizeMeetupURL(eventURL)
		if eventURL == "" {
			continue
		}

		// Time fields differ
		dateTime := ""
		if s, _ := m["dateTime"].(string); s != "" {
			dateTime = s
		} else if s, _ := m["time"].(string); s != "" {
			dateTime = s
		} else if s, _ := m["localDateTime"].(string); s != "" {
			dateTime = s
		}

		// upcoming filter
		if !utils.IsUpcoming(dateTime) {
			continue
		}

		// online filter
		isOnline := false
		if b, ok := m["isOnline"].(bool); ok {
			isOnline = b
		}
		if isOnline {
			continue
		}

		// venue
		venueName, venueCity, venueAddr := "", "", ""
		if venueAny, ok := m["venue"]; ok && venueAny != nil {
			if venueMap, ok := venueAny.(map[string]interface{}); ok {
				venueName, _ = venueMap["name"].(string)
				venueCity, _ = venueMap["city"].(string)
				venueAddr, _ = venueMap["address"].(string)
			}
		}

		location := buildMeetupLocation(city, venueName, venueAddr, venueCity)
		if strings.TrimSpace(location) == "" {
			location = "N/A"
		}

		// If heuristics say it's online, skip
		if !utils.IsOfflineEvent("", location, title) {
			continue
		}

		desc, _ := m["description"].(string)

		out = append(out, models.Event{
			EventName:   title,
			DateTime:    dateTime,
			Location:    location,
			Address:     venueAddr,
			Website:     eventURL,
			Description: desc,
			EventType:   "Offline",
			Platform:    "meetup",
		})
	}

	return out
}

func meetupNode(item interface{}) map[string]interface{} {
	m, ok := item.(map[string]interface{})
	if !ok || m == nil {
		return nil
	}
	if node, ok := m["node"].(map[string]interface{}); ok && node != nil {
		return node
	}
	return m
}

func meetupEventFromMap(eventData map[string]interface{}, city string) (models.Event, bool) {
	title, _ := eventData["title"].(string)
	if title == "" {
		title, _ = eventData["name"].(string)
	}
	title = cleanSpaceMeetup(title)
	if title == "" {
		return models.Event{}, false
	}

	dateTime, _ := eventData["dateTime"].(string)
	if dateTime == "" {
		dateTime, _ = eventData["time"].(string)
	}

	if !utils.IsUpcoming(dateTime) {
		return models.Event{}, false
	}

	description, _ := eventData["description"].(string)

	eventURL, _ := eventData["eventUrl"].(string)
	if eventURL == "" {
		eventURL, _ = eventData["link"].(string)
	}
	eventURL = normalizeMeetupURL(eventURL)
	if eventURL == "" {
		return models.Event{}, false
	}

	var venueName, venueCity, venueAddr string
	if venueAny, ok := eventData["venue"]; ok && venueAny != nil {
		if venue, ok := venueAny.(map[string]interface{}); ok {
			venueName, _ = venue["name"].(string)
			venueCity, _ = venue["city"].(string)
			venueAddr, _ = venue["address"].(string)
		}
	}

	location := buildMeetupLocation(city, venueName, venueAddr, venueCity)
	if strings.TrimSpace(location) == "" {
		location = "N/A"
	}

	isOnline := false
	if v, ok := eventData["isOnline"].(bool); ok {
		isOnline = v
	}
	if isOnline {
		return models.Event{}, false
	}

	if !utils.IsOfflineEvent("", location, title) {
		return models.Event{}, false
	}

	return models.Event{
		EventName:   title,
		Location:    location,
		Address:     venueAddr,
		DateTime:    dateTime,
		Website:     eventURL,
		Description: description,
		EventType:   "Offline",
		Platform:    "meetup",
	}, true
}

func buildMeetupLocation(fallbackCity, venueName, venueAddr, venueCity string) string {
	parts := []string{}
	if strings.TrimSpace(venueName) != "" {
		parts = append(parts, cleanSpaceMeetup(venueName))
	}
	if strings.TrimSpace(venueAddr) != "" {
		parts = append(parts, cleanSpaceMeetup(venueAddr))
	}
	if strings.TrimSpace(venueCity) != "" {
		parts = append(parts, cleanSpaceMeetup(venueCity))
	} else if strings.TrimSpace(fallbackCity) != "" {
		parts = append(parts, cleanSpaceMeetup(fallbackCity))
	}
	return strings.TrimSpace(strings.Join(parts, ", "))
}

// ✅ Reads location from the event detail page
func (s *MeetupScraper) enrichFromEventPage(allocCtx context.Context, eventURL string) (location string, address string) {
	eventURL = normalizeMeetupURL(eventURL)
	if eventURL == "" {
		return "", ""
	}

	var html string
	err := chromedp.Run(
		allocCtx,
		chromedp.Navigate(eventURL),
		chromedp.Sleep(3*time.Second),
		chromedp.OuterHTML("html", &html),
	)
	if err != nil || strings.TrimSpace(html) == "" {
		return "", ""
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return "", ""
	}

	needsLoc := strings.TrimSpace(doc.Find(`[data-testid="needs-location"]`).First().Text())
	if needsLoc != "" && strings.Contains(strings.ToLower(needsLoc), "needs a location") {
		return "N/A", ""
	}

	// venue/location candidates
	candidates := []string{
		`[data-testid="venue-name"]`,
		`[data-testid="event-info-venue"]`,
		`[data-testid="location"]`,
		`.venueDisplay`,
		`.eventInfo-address`,
		`address`,
	}
	for _, sel := range candidates {
		txt := strings.TrimSpace(doc.Find(sel).First().Text())
		txt = cleanSpaceMeetup(txt)
		if txt != "" {
			location = txt
			break
		}
	}

	// address candidates
	addrCandidates := []string{
		`[data-testid="venue-address"]`,
		`.eventInfo-address`,
		`address`,
	}
	for _, sel := range addrCandidates {
		txt := strings.TrimSpace(doc.Find(sel).First().Text())
		txt = cleanSpaceMeetup(txt)
		if txt != "" {
			address = txt
			break
		}
	}

	if strings.EqualFold(location, "location") {
		location = ""
	}

	return location, address
}

func normalizeMeetupURL(href string) string {
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	if strings.HasPrefix(href, "http://") || strings.HasPrefix(href, "https://") {
		return href
	}
	if strings.HasPrefix(href, "//") {
		return "https:" + href
	}
	if strings.HasPrefix(href, "/") {
		return "https://www.meetup.com" + href
	}
	if strings.Contains(href, "meetup.com/") {
		return "https://" + href
	}
	return ""
}

// ⚠️ Unique name so it doesn't clash with HasGeek (no redeclare errors)
func cleanSpaceMeetup(s string) string {
	s = strings.ReplaceAll(s, "\u00a0", " ")
	return strings.Join(strings.Fields(s), " ")
}

func dedupeMeetupByWebsite(in []models.Event) []models.Event {
	seen := map[string]bool{}
	out := make([]models.Event, 0, len(in))
	for _, e := range in {
		k := strings.TrimSpace(e.Website)
		if k == "" {
			k = e.EventName + "|" + e.DateTime
		}
		if !seen[k] {
			seen[k] = true
			out = append(out, e)
		}
	}
	return out
}
