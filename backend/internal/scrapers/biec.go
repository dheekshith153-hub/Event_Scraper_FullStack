package scrapers

import (
	"context"
	"event-scraper/internal/models"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)



const biecAddress = "BIEC - Bangalore International Exhibition Centre, 10th Mile, Tumkur Road, Madavara Post, Dasanapura Hobli, Bengaluru, Karnataka 562123, India"


var techKeywords = []string{
	"tech", "digital", "software", "hardware", "it ", " it,", "iot",
	"automation", "robotics", "robot", "ai ", "artificial intelligence",
	"machine learning", "data", "cyber", "cloud", "semiconductor",
	"electronic", "electrical", "electric vehicle", "ev ", "solar",
	"energy", "power", "renewable", "green energy",
	"engineering", "manufacturing", "industrial", "industry",
	"machinery", "machine", "tool", "tooltech", "imtex",
	"lab", "laboratory", "medtech", "biotech", "pharma",
	"logistics", "warehouse", "material handling", "supply chain",
	"print", "packaging", "smart home", "smart office",
	"cable", "wire", "lift", "mobility",
	"surface finishing", "coating", "chemical",
	"expo", "summit", "conference", "hackathon",
}

// pastEventRe matches dates that are clearly in the past relative to 2026-02-17.
// We parse properly below; this is just a quick pre-filter string check.
var yearRe = regexp.MustCompile(`\b(201[0-9]|202[0-4])\b`)


var biecDateFormats = []string{
	"January 2, 2006",
	"January 2, 2006",
}



type BIECScraper struct {
	*BaseScraper
	url string
}

func NewBIECScraper(timeout time.Duration, retries int) *BIECScraper {
	return &BIECScraper{
		BaseScraper: NewBaseScraper(timeout, retries),
		url:         "https://www.biec.in/events",
	}
}

func (s *BIECScraper) Name() string {
	return "biec"
}

func (s *BIECScraper) Scrape(ctx context.Context) ([]models.Event, error) {
	resp, err := s.FetchWithRetry(ctx, s.url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch BIEC: %w", err)
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse BIEC HTML: %w", err)
	}

	var events []models.Event
	baseURL := "https://www.biec.in/"
	now := time.Now()

	
	doc.Find("h3").Each(func(_ int, h3 *goquery.Selection) {
		titleLink := h3.Find("a").First()
		title := strings.TrimSpace(titleLink.Text())
		if title == "" {
			return
		}

		
		href, _ := titleLink.Attr("href")
		website := ""
		switch {
		case strings.HasPrefix(href, "http"):
			website = href
		case strings.HasPrefix(href, "/"):
			website = "https://www.biec.in" + href
		case href != "":
			website = baseURL + href // e.g. https://www.biec.in/Calendar_event/2k26/name.php
		}

		// FIX 3 + 4: Walk NEXT siblings of <h3> to collect organizer / date /
		// time / location from text nodes and the <strong> tag.
		// There are no span wrappers — data lives as raw text between <br> tags.
		organizer := ""
		dateStr := ""
		timeStr := ""
		location := ""
		readMoreURL := "" // Prefer "Read More" link over title link when present

		h3.NextAll().EachWithBreak(func(_ int, sib *goquery.Selection) bool {
			tag := goquery.NodeName(sib)

			// Stop when we hit the next event's <img> or <h3>
			if tag == "img" || tag == "h3" {
				return false
			}

			// FIX 4: Organizer is in <strong>, not <small><b>
			if tag == "strong" {
				if organizer == "" {
					organizer = strings.TrimSpace(sib.Text())
				}
				return true
			}

			// Grab "Read More" absolute URL if present
			if tag == "a" {
				if strings.Contains(strings.ToLower(sib.Text()), "read more") {
					if rHref, ok := sib.Attr("href"); ok && rHref != "" {
						switch {
						case strings.HasPrefix(rHref, "http"):
							readMoreURL = rHref
						case strings.HasPrefix(rHref, "/"):
							readMoreURL = "https://www.biec.in" + rHref
						default:
							readMoreURL = baseURL + rHref
						}
					}
				}
				return true
			}

			// FIX 3: Collect raw text nodes (they come between <br> tags).
			// Each meaningful line is one of: date, time, location.
			rawText := strings.TrimSpace(sib.Text())
			if rawText == "" {
				return true
			}

			
			switch {
			case isDateText(rawText) && dateStr == "":
				dateStr = rawText
			case isTimeText(rawText) && timeStr == "":
				timeStr = rawText
			case location == "" && looksLikeLocation(rawText):
				location = rawText
			}

			return true
		})

		// Prefer the "Read More" URL (it's the same page but confirms it exists)
		if readMoreURL != "" {
			website = readMoreURL
		}

		if location == "" {
			location = "BIEC, Bengaluru, Karnataka"
		}

		// ── FIX 5: Proper upcoming filter ────────────────────────────────────
		// The old code never got a date (bug 3), so IsUpcoming("") let
		// everything through — including events from 2018 through 2025.
		// Now we parse the real date and compare against today.
		if !biecIsUpcoming(dateStr, now) {
			return
		}

		// ── FIX 7: Technology relevance filter ───────────────────────────────
		// BIEC hosts non-tech events (jewellery, food, fitness, fashion).
		// Only store events whose title matches at least one tech keyword.
		if !isTechEvent(title) {
			fmt.Printf("BIEC: Skipping non-tech event: %q\n", title)
			return
		}

		event := models.Event{
			EventName:   title,
			Location:    location,
			Address:     biecAddress,
			Date:        dateStr,
			Time:        timeStr,
			Website:     website,
			Description: fmt.Sprintf("Organized by: %s", organizer),
			EventType:   "Offline",
			Platform:    "biec",
		}

		events = append(events, event)
		fmt.Printf("BIEC: Adding event: %q | %s\n", title, dateStr)
	})

	fmt.Printf("BIEC: Found %d upcoming tech events\n", len(events))
	return events, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

var monthNames = []string{
	"january", "february", "march", "april", "may", "june",
	"july", "august", "september", "october", "november", "december",
}

// isDateText returns true if the string contains a month name and a 4-digit year.
// Examples that match:
//   "January 15 - 17, 2026"
//   "February 26 - March 01, 2026"
//   "April 6- 8, 2026"
func isDateText(s string) bool {
	lower := strings.ToLower(s)
	hasMonth := false
	for _, m := range monthNames {
		if strings.Contains(lower, m) {
			hasMonth = true
			break
		}
	}
	return hasMonth && regexp.MustCompile(`\b20\d{2}\b`).MatchString(s)
}

// isTimeText returns true if the string looks like a time range.
// Examples: "9:00am - 6:00pm", "10:00am - 5:00pm"
func isTimeText(s string) bool {
	lower := strings.ToLower(s)
	return (strings.Contains(lower, "am") || strings.Contains(lower, "pm")) &&
		strings.Contains(s, ":")
}

// looksLikeLocation returns true for city/state strings like "Bengaluru, Karnataka".
func looksLikeLocation(s string) bool {
	lower := strings.ToLower(s)
	return strings.Contains(lower, "bengaluru") ||
		strings.Contains(lower, "bangalore") ||
		strings.Contains(lower, "karnataka") ||
		strings.Contains(lower, "india")
}


func biecIsUpcoming(dateStr string, now time.Time) bool {
	if dateStr == "" {
		// No date found — include it so we don't silently miss events
		return true
	}

	// Quick reject on clearly old years (2010–2024)
	if m := yearRe.FindString(dateStr); m != "" {
		return false
	}

	// Normalize: remove spaces around dashes that separate day ranges
	// "April 6- 8, 2026" → "April 6-8, 2026"
	normalized := regexp.MustCompile(`\s*-\s*`).ReplaceAllString(dateStr, "-")

	
	endDate := extractEndDate(normalized)

	layouts := []string{
		"January 2, 2006",
		"January 02, 2006",
		"Jan 2, 2006",
		"Jan 02, 2006",
	}
	for _, layout := range layouts {
		t, err := time.Parse(layout, endDate)
		if err == nil {
			// Event is upcoming if its end date is today or later
			return !t.Before(now.Truncate(24 * time.Hour))
		}
	}

	// Parse failed — include rather than silently discard
	fmt.Printf("BIEC: could not parse date %q (normalized: %q) — including event\n", dateStr, endDate)
	return true
}


func extractEndDate(s string) string {
	// Cross-month: "February 26-March 01, 2026"
	// Pattern: Month Day-Month Day, Year
	crossMonth := regexp.MustCompile(
		`(?i)([A-Za-z]+ \d{1,2})-([A-Za-z]+ \d{1,2}),\s*(\d{4})`,
	)
	if m := crossMonth.FindStringSubmatch(s); len(m) == 4 {
		// End date is "March 01, 2026"
		return m[2] + ", " + m[3]
	}

	// Same-month range: "April 6-8, 2026" or "January 15-17, 2026"
	sameMonth := regexp.MustCompile(
		`(?i)([A-Za-z]+) \d{1,2}-(\d{1,2}),\s*(\d{4})`,
	)
	if m := sameMonth.FindStringSubmatch(s); len(m) == 4 {
		// End date is "April 8, 2026"
		return m[1] + " " + m[2] + ", " + m[3]
	}

	// Single day: "February 17, 2026" — return as-is
	return s
}

// isTechEvent returns true if the event title contains at least one
// technology-related keyword (case-insensitive).
func isTechEvent(title string) bool {
	lower := strings.ToLower(title)
	for _, kw := range techKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}