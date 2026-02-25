package scrapers

import (
	"context"
	"event-scraper/internal/models"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"
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
	"surface finishing", "finishing", "coating", "paint", "chemical",
	"expo", "summit", "conference", "hackathon",
}

var monthNames = []string{
	"january", "february", "march", "april", "may", "june",
	"july", "august", "september", "october", "november", "december",
}

var yearOldRe = regexp.MustCompile(`\b(201[0-9]|202[0-4])\b`)
var yearAnyRe = regexp.MustCompile(`\b(20\d{2})\b`)

type BIECScraper struct {
	*BaseScraper
	url string
}

var techAllow = []string{
	"automation", "robotics", "robot", "industrial", "manufacturing", "industry",
	"machine", "machinery", "tool", "tooltech", "imtex", "forming", "digital manufacturing",
	"electronics", "electronica", "productronica", "semiconductor",
	"electrical", "power", "energy", "renewable", "solar", "ev", "vehicle", "mobility",
	"lab", "labex", "laboratory", "pharma", "pharmatech", "biotech", "medtech",
	"cyber", "security", "cloud", "data", "ai", "artificial intelligence", "machine learning",
	"warehouse", "logistic", "logistics", "material handling", "supply chain",
	"surface finishing", "finishing", "coating", "paint",
	"drone", "space", "aerospace",
	"wire", "cable",
	"sap", "microsoft", "google", "salesforce", "hackathon", "teched",
}

// Non-tech block-list (these should always be excluded)
var nonTechBlock = []string{
	"food", "dairy", "bakery", "kitchen", "poultry",
	"travel", "tourism",
	"perfume", "agarbatti", "fragrance",
	"jewellery", "fashion", "apparel",
	"mattress", "fitness", "family fest", "herbalife",
	"interior", "décor", "decor", "facades", "doors windows", // usually construction/interiors
	"acetech", // if you consider this non-tech for your site
}

// Optional: allow by URL slug hints (helps when titles are short)
var techURLHints = []string{
	"electronica", "productronica", "labex", "pharma", "space", "drone",
	"imtex", "tooltech", "automation", "robot", "manufacturing", "digital",
	"warehouse", "logistic", "surface", "coating", "cable", "wire", "ev",
}

func isTechEvent(title string, website string) bool {
	t := strings.ToLower(cleanSpace(title))
	u := strings.ToLower(strings.TrimSpace(website))

	// Hard block: if any non-tech phrase appears, reject
	for _, bad := range nonTechBlock {
		if strings.Contains(t, bad) {
			return false
		}
	}

	// Strong allow: title contains any tech term
	for _, good := range techAllow {
		if strings.Contains(t, good) {
			return true
		}
	}

	// Fallback: URL hints
	for _, hint := range techURLHints {
		if strings.Contains(u, hint) {
			return true
		}
	}

	return false
}

func NewBIECScraper(timeout time.Duration, retries int) *BIECScraper {
	return &BIECScraper{
		BaseScraper: NewBaseScraper(timeout, retries),
		url:         "https://www.biec.in/events",
	}
}

func (s *BIECScraper) Name() string { return "biec" }

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPE
// ─────────────────────────────────────────────────────────────────────────────

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
	baseURL := "https://www.biec.in"
	now := time.Now().Truncate(24 * time.Hour)

	doc.Find("h3").Each(func(_ int, h3 *goquery.Selection) {
		titleLink := h3.Find("a").First()
		title := cleanSpace(strings.TrimSpace(titleLink.Text()))
		if title == "" {
			return
		}

		// Website from title <a>
		href := strings.TrimSpace(titleLink.AttrOr("href", ""))
		website := absURL(baseURL, href)

		// Prefer "Read More" URL if present after this h3
		readMoreURL := findReadMoreURLAfterH3(h3, baseURL)
		if readMoreURL != "" {
			website = readMoreURL
		}

		// Organizer often in <strong> after h3
		organizer := ""
		if st := h3.NextAllFiltered("strong").First(); st.Length() > 0 {
			organizer = cleanSpace(st.Text())
		}

		// ✅ CRITICAL FIX:
		// BIEC puts date/time/location as TEXT NODES between <br>.
		// goquery.NextAll() only walks ELEMENT siblings, so we must walk real siblings.
		lines := collectLinesAfterH3(h3)

		dateStr := ""
		timeStr := ""
		location := ""

		for _, line := range lines {
			t := normalizeLine(line)
			if t == "" {
				continue
			}

			if dateStr == "" && looksLikeDate(t) {
				dateStr = t
				continue
			}
			if timeStr == "" && looksLikeTime(t) {
				timeStr = t
				continue
			}
			if location == "" && looksLikeLocation(t) {
				location = t
				continue
			}
		}

		// If location still empty, fall back (site is BIEC)
		if location == "" {
			location = "BIEC, Bengaluru, Karnataka"
		}

		// If date is still empty, don’t store blank-date events (prevents Date TBA cards)
		// If you prefer to keep them, change this to: if dateStr == "" { /* keep */ }
		if dateStr == "" {
			fmt.Printf("BIEC: missing date for %q (url=%s). Lines=%v\n", title, website, lines)
			return
		}

		// Skip clearly old-year strings quickly
		if yearOldRe.MatchString(dateStr) {
			return
		}

		// Only keep upcoming (based on parsed END date of range)
		if !biecIsUpcoming(dateStr, now) {
			return
		}

		// Optional: tech relevance filter (keep your current behavior)
		if !isTechEvent(title, website) {
			fmt.Printf("BIEC: Skipping non-tech event: %q\n", title)
			return
		}

		events = append(events, models.Event{
			EventName:   title,
			Location:    location,
			Address:     biecAddress,
			Date:        dateStr,
			Time:        timeStr,
			Website:     website,
			Description: organizerDescription(organizer),
			EventType:   "Offline",
			Platform:    "biec",
		})

		fmt.Printf("BIEC: adding %q | date=%q | time=%q | loc=%q\n", title, dateStr, timeStr, location)
	})

	fmt.Printf("BIEC: Found %d upcoming tech events\n", len(events))
	return events, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────────────────────────────────────

// collectLinesAfterH3 walks *real* siblings (including TEXT nodes) until the next h3/img.
// It treats <br> and some block tags as line breaks and returns cleaned “lines”.
func collectLinesAfterH3(h3 *goquery.Selection) []string {
	n := h3.Get(0)
	if n == nil {
		return nil
	}

	var lines []string
	var buf strings.Builder

	flush := func() {
		t := cleanSpace(buf.String())
		if t != "" {
			// Sometimes multiple chunks join → keep as one line
			lines = append(lines, t)
		}
		buf.Reset()
	}

	for sib := n.NextSibling; sib != nil; sib = sib.NextSibling {
		if sib.Type == html.ElementNode {
			tag := strings.ToLower(sib.Data)

			// stop at next event block
			if tag == "h3" || tag == "img" {
				flush()
				break
			}

			// treat <br> as end-of-line
			if tag == "br" {
				flush()
				continue
			}

			// some elements should flush before/after (paragraph-like)
			if tag == "p" || tag == "div" || tag == "strong" || tag == "small" {
				flush()
				text := cleanSpace(goquery.NewDocumentFromNode(sib).Text())
				if text != "" {
					lines = append(lines, text)
				}
				flush()
				continue
			}

			// anchors etc: add their text to current buffer (don’t force new line)
			txt := cleanSpace(goquery.NewDocumentFromNode(sib).Text())
			if txt != "" {
				if buf.Len() > 0 {
					buf.WriteString(" ")
				}
				buf.WriteString(txt)
			}
			continue
		}

		// TEXT node
		if sib.Type == html.TextNode {
			t := cleanSpace(sib.Data)
			if t != "" {
				if buf.Len() > 0 {
					buf.WriteString(" ")
				}
				buf.WriteString(t)
			}
		}
	}

	flush()
	return compactLines(lines)
}

func compactLines(in []string) []string {
	var out []string
	for _, s := range in {
		s = normalizeLine(s)
		if s == "" {
			continue
		}
		// drop obvious nav text
		ls := strings.ToLower(s)
		if strings.Contains(ls, "read more") || strings.Contains(ls, "download") {
			continue
		}
		out = append(out, s)
	}
	return out
}

func findReadMoreURLAfterH3(h3 *goquery.Selection, baseURL string) string {
	readMoreURL := ""
	h3.NextAllFiltered("a").EachWithBreak(func(_ int, a *goquery.Selection) bool {
		txt := strings.ToLower(cleanSpace(a.Text()))
		if strings.Contains(txt, "read more") {
			href := strings.TrimSpace(a.AttrOr("href", ""))
			readMoreURL = absURL(baseURL, href)
			return false
		}
		// Stop if we hit next <h3> (different event)
		if goquery.NodeName(a.Parent()) == "h3" {
			return false
		}
		return true
	})
	return readMoreURL
}

func absURL(base, href string) string {
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	if strings.HasPrefix(href, "http://") || strings.HasPrefix(href, "https://") {
		return href
	}
	if strings.HasPrefix(href, "/") {
		return base + href
	}
	return base + "/" + href
}

func organizerDescription(org string) string {
	org = cleanSpace(org)
	if org == "" {
		return ""
	}
	return fmt.Sprintf("Organized by: %s", org)
}

// ─────────────────────────────────────────────────────────────────────────────
// Text detection
// ─────────────────────────────────────────────────────────────────────────────

func normalizeLine(s string) string {
	s = strings.ReplaceAll(s, "\u00a0", " ")
	s = strings.ReplaceAll(s, "–", "-")
	s = strings.ReplaceAll(s, "—", "-")
	s = cleanSpace(s)
	return s
}

func cleanSpace(s string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
}

func looksLikeLocation(s string) bool {
	lower := strings.ToLower(s)
	return strings.Contains(lower, "bengaluru") ||
		strings.Contains(lower, "bangalore") ||
		strings.Contains(lower, "karnataka") ||
		strings.Contains(lower, "india") ||
		strings.Contains(lower, "biec")
}

func looksLikeTime(s string) bool {
	lower := strings.ToLower(s)
	// covers "9:00am - 6:00pm", "09:00 AM – 06:00 PM"
	return (strings.Contains(lower, "am") || strings.Contains(lower, "pm")) &&
		strings.Contains(s, ":")
}

func looksLikeDate(s string) bool {
	lower := strings.ToLower(s)

	// must include a month name OR a month short name
	hasMonth := false
	for _, m := range monthNames {
		if strings.Contains(lower, m) {
			hasMonth = true
			break
		}
	}
	if !hasMonth {
		// also accept short months like "May", "Apr" etc
		short := regexp.MustCompile(`\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b`)
		hasMonth = short.MatchString(lower)
	}

	// year is strongly expected on BIEC listing
	return hasMonth && yearAnyRe.MatchString(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming logic
// ─────────────────────────────────────────────────────────────────────────────

func biecIsUpcoming(dateStr string, now time.Time) bool {
	end := extractEndDateForBIEC(dateStr)
	t, ok := parseBIECEndDate(end)
	if !ok {
		// If parse fails, keep it (or set false if you prefer strict)
		fmt.Printf("BIEC: could not parse date %q (end=%q) — keeping\n", dateStr, end)
		return true
	}
	return !t.Before(now)
}

func parseBIECEndDate(s string) (time.Time, bool) {
	s = normalizeLine(s)

	layouts := []string{
		"January 2, 2006",
		"January 02, 2006",
		"Jan 2, 2006",
		"Jan 02, 2006",
		"2 January 2006",
		"02 January 2006",
		"2 Jan 2006",
		"02 Jan 2006",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Truncate(24 * time.Hour), true
		}
	}

	return time.Time{}, false
}

// extractEndDateForBIEC tries hard to turn ranges into a single end-date string.
// Examples handled:
// - "May 27 - 29, 2026"           -> "May 29, 2026"
// - "May 27-29, 2026"             -> "May 29, 2026"
// - "May 27 to 29, 2026"          -> "May 29, 2026"
// - "February 26 - March 01, 2026"-> "March 01, 2026"
// - "27-29 May 2026"              -> "29 May 2026"
// - "27 May - 29 May 2026"        -> "29 May 2026"
// - "May 27, 2026"                -> itself
func extractEndDateForBIEC(s string) string {
	s = normalizeLine(s)

	// 1) Cross-month: "February 26 - March 01, 2026" (dash or "to")
	crossMonth := regexp.MustCompile(`(?i)\b([A-Za-z]+)\s+\d{1,2}\s*(?:-|to)\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\b`)
	if m := crossMonth.FindStringSubmatch(s); len(m) == 5 {
		// "March 01, 2026"
		return fmt.Sprintf("%s %s, %s", m[2], m[3], m[4])
	}

	// 2) Same-month: "May 27 - 29, 2026" or "May 27 to 29, 2026"
	sameMonth := regexp.MustCompile(`(?i)\b([A-Za-z]+)\s+(\d{1,2})\s*(?:-|to)\s*(\d{1,2}),\s*(\d{4})\b`)
	if m := sameMonth.FindStringSubmatch(s); len(m) == 5 {
		return fmt.Sprintf("%s %s, %s", m[1], m[3], m[4])
	}

	// 3) Day-first range: "27-29 May 2026"
	dayFirst := regexp.MustCompile(`(?i)\b(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b`)
	if m := dayFirst.FindStringSubmatch(s); len(m) == 5 {
		return fmt.Sprintf("%s %s %s", m[2], m[3], m[4]) // "29 May 2026"
	}

	// 4) Day+Month range: "27 May - 29 May 2026"
	dayMonthRange := regexp.MustCompile(`(?i)\b(\d{1,2})\s+([A-Za-z]+)\s*(?:-|to)\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b`)
	if m := dayMonthRange.FindStringSubmatch(s); len(m) == 6 {
		return fmt.Sprintf("%s %s %s", m[3], m[4], m[5]) // "29 May 2026"
	}

	// 5) Already single date
	return s
}

