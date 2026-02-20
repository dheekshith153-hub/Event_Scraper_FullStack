package scrapers

import (
	"context"
	"event-scraper/internal/models"
	"event-scraper/pkg/utils"
	"fmt"
	"io"
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

func (s *HITEXScraper) Name() string { return "hitex" }

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

	dateRe := regexp.MustCompile(`(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})`)
	hitexBase := "https://hitex.co.in"

	seen  := map[string]bool{}
	var events []models.Event

	// ── Strategy 1: event card containers (class variations HITEX uses) ──
	selectors := []string{
		"div.event-item",
		"div.event-card",
		"div.col-md-4",      // common bootstrap grid cards
		"div.col-lg-4",
		"article",
		"div.event",
	}

	for _, sel := range selectors {
		doc.Find(sel).Each(func(_ int, card *goquery.Selection) {
			s.parseHitexCard(ctx, card, hitexBase, dateRe, seen, &events)
		})
		if len(events) > 0 {
			break // stop on first selector that yields results
		}
	}

	// ── Strategy 2: fallback — look for any <a> whose href ends in .html
	//    containing a date string nearby (catches table-row layouts)
	if len(events) == 0 {
		doc.Find("a[href$='.html'], a[href*='/event']").Each(func(_ int, a *goquery.Selection) {
			title := strings.TrimSpace(a.Text())
			if len(title) < 4 || title == "Upcoming Events" {
				return
			}
			href, _ := a.Attr("href")
			if href == "" || href == "#" {
				return
			}

			// Deduplicate by title
			key := strings.ToLower(title)
			if seen[key] {
				return
			}

			website := resolveURL(hitexBase, href)

			// Look for a date in the surrounding tr/div/li
			parent := a.Parent()
			for depth := 0; depth < 5 && parent.Length() > 0; depth++ {
				text := parent.Text()
				if m := dateRe.FindStringSubmatch(text); len(m) >= 4 {
					date := fmt.Sprintf("%s %s %s", m[1], m[2], m[3])
					if !utils.IsUpcoming(date) {
						return
					}

					// Fetch the event detail page for description + external link
					desc, extURL := s.fetchEventPageDetails(ctx, website, hitexBase)

					seen[key] = true
					events = append(events, models.Event{
						EventName:   title,
						Location:    "HITEX Exhibition Centre, Hyderabad",
						Address:     "Off Izzat Nagar, Kondapur, Hyderabad, Telangana 500084",
						Date:        date,
						Website:     website,
						Description: buildHitexDesc(desc, extURL),
						EventType:   "Offline",
						Platform:    "hitex",
					})
					break
				}
				parent = parent.Parent()
			}
		})
	}

	fmt.Printf("HITEX: Found %d upcoming offline events\n", len(events))
	return events, nil
}

// parseHitexCard tries to extract event data from a single card element.
func (s *HITEXScraper) parseHitexCard(
	ctx context.Context,
	card *goquery.Selection,
	base string,
	dateRe *regexp.Regexp,
	seen map[string]bool,
	events *[]models.Event,
) {
	// Title: h3 > a, h4 > a, .event-title, or first strong
	title := ""
	card.Find("h3 a, h4 a, h2 a, .event-title a, .card-title a").EachWithBreak(func(_ int, a *goquery.Selection) bool {
		t := strings.TrimSpace(a.Text())
		if len(t) > 3 {
			title = t
			return false
		}
		return true
	})
	if title == "" {
		card.Find("h3, h4, h2, .event-title, .card-title").EachWithBreak(func(_ int, el *goquery.Selection) bool {
			t := strings.TrimSpace(el.Text())
			if len(t) > 3 {
				title = t
				return false
			}
			return true
		})
	}
	if title == "" {
		return
	}
	key := strings.ToLower(title)
	if seen[key] {
		return
	}

	// Date
	fullText := card.Text()
	date := ""
	if m := dateRe.FindStringSubmatch(fullText); len(m) >= 4 {
		date = fmt.Sprintf("%s %s %s", m[1], m[2], m[3])
	}
	if !utils.IsUpcoming(date) {
		return
	}

	// Link
	website := ""
	card.Find("a").EachWithBreak(func(_ int, a *goquery.Selection) bool {
		if href, ok := a.Attr("href"); ok && href != "" && href != "#" {
			website = resolveURL(base, href)
			return false
		}
		return true
	})

	// Fetch event detail page for description + external organiser website
	desc, extURL := s.fetchEventPageDetails(ctx, website, base)

	seen[key] = true
	*events = append(*events, models.Event{
		EventName:   title,
		Location:    "HITEX Exhibition Centre, Hyderabad",
		Address:     "Off Izzat Nagar, Kondapur, Hyderabad, Telangana 500084",
		Date:        date,
		Website:     website,
		Description: buildHitexDesc(desc, extURL),
		EventType:   "Offline",
		Platform:    "hitex",
	})
}

// fetchEventPageDetails fetches an individual HITEX event page, looks for:
//  1. The "Website" button (type="button" with an external href)
//  2. Follows that external URL and extracts plain-text description
//
// Returns (description string, externalURL string).
func (s *HITEXScraper) fetchEventPageDetails(ctx context.Context, pageURL, base string) (string, string) {
	if pageURL == "" {
		return "", ""
	}

	// Fetch the HITEX event detail page
	resp, err := s.FetchWithRetry(ctx, pageURL)
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", ""
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
	if err != nil {
		return "", ""
	}

	// ── Find the external "Website" button ──────────────────────────
	// Pattern: <a type="button" href="https://..." ...>...<span>Website</span>
	extURL := ""
	doc.Find(`a[type="button"][href], a.btn[href]`).Each(func(_ int, a *goquery.Selection) {
		spanText := strings.ToLower(strings.TrimSpace(a.Find("span").Text()))
		linkText := strings.ToLower(strings.TrimSpace(a.Text()))
		if strings.Contains(spanText, "website") || strings.Contains(linkText, "website") {
			if href, ok := a.Attr("href"); ok &&
				strings.HasPrefix(href, "http") &&
				!strings.Contains(href, "hitex.co.in") {
				extURL = href
			}
		}
	})

	// ── Description from HITEX page itself ──────────────────────────
	desc := ""
	for _, sel := range []string{
		".event-description", ".event-details p",
		"#about p", ".about-content", ".description",
		"main p", ".content p",
	} {
		doc.Find(sel).Each(func(_ int, p *goquery.Selection) {
			t := strings.TrimSpace(p.Text())
			if len(t) > 40 {
				desc += t + "\n"
			}
		})
		if len(desc) > 80 {
			break
		}
	}

	// ── If no description and external URL exists, scrape it ────────
	if desc == "" && extURL != "" {
		desc = s.scrapeExternalWebsite(ctx, extURL)
	}

	return strings.TrimSpace(desc), extURL
}

// scrapeExternalWebsite fetches an organiser website and extracts
// the most relevant "About" or introductory paragraph(s).
func (s *HITEXScraper) scrapeExternalWebsite(ctx context.Context, url string) string {
	resp, err := s.FetchWithRetry(ctx, url)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
	if err != nil {
		return ""
	}

	// Remove nav, header, footer, script, style noise
	doc.Find("nav, header, footer, script, style, noscript, aside, .navbar, .footer, .header, .menu, .sidebar").Remove()

	var parts []string

	// Prefer explicit "About" sections
	aboutSelectors := []string{
		"#about", ".about-section", ".about-content",
		"[class*='about']", "[id*='about']",
		"section:first-of-type",
	}
	for _, sel := range aboutSelectors {
		doc.Find(sel).EachWithBreak(func(_ int, el *goquery.Selection) bool {
			text := hitexCleanText(el.Text())
			if len(text) > 80 {
				parts = append(parts, text)
				return false
			}
			return true
		})
		if len(parts) > 0 {
			break
		}
	}

	// Fallback: first substantial paragraph(s) from main content
	if len(parts) == 0 {
		doc.Find("main p, article p, .content p, section p, p").Each(func(_ int, p *goquery.Selection) {
			text := hitexCleanText(p.Text())
			if len(text) > 60 {
				parts = append(parts, text)
			}
		})
	}

	// Return up to ~400 chars of combined description
	result := strings.Join(parts, " ")
	if len(result) > 450 {
		result = result[:447] + "..."
	}
	return strings.TrimSpace(result)
}

// cleanText collapses whitespace and trims a string.
func hitexCleanText(s string) string {
	// Replace all whitespace runs with a single space
	re := regexp.MustCompile(`\s+`)
	return strings.TrimSpace(re.ReplaceAllString(s, " "))
}

// buildHitexDesc assembles a clean description for storage.
func buildHitexDesc(desc, extURL string) string {
	if desc == "" && extURL == "" {
		return ""
	}
	if extURL != "" && desc == "" {
		return fmt.Sprintf("More information: %s", extURL)
	}
	if extURL != "" {
		return fmt.Sprintf("%s\n\nMore information: %s", desc, extURL)
	}
	return desc
}
