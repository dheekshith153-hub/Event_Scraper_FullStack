package scrapers

import (
	"compress/gzip"
	"context"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
)

const (
	detailScraperMinDelay     = 3
	detailScraperMaxDelay     = 7
	detailScraperReScrapeDays = 7
)

type DetailScraper struct {
	*BaseScraper
	db *sql.DB
}

type EventFromDB struct {
	ID       int64
	Name     string
	Website  string
	Platform string
	Location string
}

type ScrapedDetail struct {
	EventID          int64
	FullDescription  string
	Organizer        string
	OrganizerContact string
	ImageURL         string
	Tags             string
	Price            string
	RegistrationURL  string
	ExternalURL      string
	Duration         string
	AgendaHTML       string
	SpeakersJSON     string
	Prerequisites    string
	MaxAttendees     int
	AttendeesCount   int
	ScrapedBody      string
}

func NewDetailScraper(db *sql.DB, timeout time.Duration, retries int) *DetailScraper {
	return &DetailScraper{
		BaseScraper: NewBaseScraper(timeout, retries),
		db:          db,
	}
}

func (s *DetailScraper) Name() string { return "detail-scraper" }

func (s *DetailScraper) Scrape(ctx context.Context, onDetail func(ScrapedDetail) error) error {
	events, err := s.getEventsFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to get events from database: %w", err)
	}

	if len(events) == 0 {
		fmt.Println("✅ DetailScraper: No events need scraping")
		return nil
	}

	fmt.Printf("\n🔍 DetailScraper: Found %d events to scrape\n", len(events))
	fmt.Println(strings.Repeat("=", 80))

	successCount, failCount, savedCount := 0, 0, 0

	for i, event := range events {
		select {
		case <-ctx.Done():
			fmt.Printf("\n⚠️  Cancelled after %d/%d events\n", i, len(events))
			return ctx.Err()
		default:
		}

		if i > 0 {
			delay := time.Duration(detailScraperMinDelay+randomInt(detailScraperMaxDelay-detailScraperMinDelay+1)) * time.Second
			fmt.Printf("⏳ Waiting %v...\n", delay)
			time.Sleep(delay)
		}

		fmt.Printf("\n[%d/%d] %s\n        URL: %s\n        Platform: %s\n",
			i+1, len(events), event.Name, event.Website, event.Platform)

		detail, err := s.scrapeEventDetailPage(ctx, event)
		if err != nil {
			fmt.Printf("❌ Failed: %v\n", err)
			failCount++
			continue
		}

		successCount++
		fmt.Printf("✅ Scraped: %d chars\n", len(detail.FullDescription))

		if err := onDetail(*detail); err != nil {
			fmt.Printf("⚠️  DB save failed for event_id=%d: %v\n", detail.EventID, err)
		} else {
			savedCount++
			fmt.Printf("💾 Saved event_id=%d (%d/%d)\n", detail.EventID, savedCount, len(events))
		}

		if (i+1)%10 == 0 {
			fmt.Println(strings.Repeat("-", 80))
			fmt.Printf("📊 %d/%d | OK:%d Saved:%d Fail:%d\n", i+1, len(events), successCount, savedCount, failCount)
			fmt.Println(strings.Repeat("-", 80))
		}
	}

	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("✅ Done: Scraped=%d Saved=%d Failed=%d\n\n", successCount, savedCount, failCount)
	return nil
}

func (s *DetailScraper) getEventsFromDatabase() ([]EventFromDB, error) {
	query := `
		SELECT e.id, e.event_name, e.website, e.platform, e.location
		FROM events e
		LEFT JOIN event_details ed ON e.id = ed.event_id
		WHERE e.website IS NOT NULL 
		  AND e.website != ''
		  AND e.website NOT LIKE '%javascript:%'
		  AND e.website NOT LIKE '%#%'
		  AND (
			  ed.id IS NULL 
			  OR ed.last_scraped < NOW() - INTERVAL '7 days'
		  )
		ORDER BY e.created_at DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []EventFromDB
	for rows.Next() {
		var e EventFromDB
		if err := rows.Scan(&e.ID, &e.Name, &e.Website, &e.Platform, &e.Location); err != nil {
			continue
		}
		events = append(events, e)
	}
	return events, nil
}

func (s *DetailScraper) scrapeEventDetailPage(ctx context.Context, event EventFromDB) (*ScrapedDetail, error) {
	if event.Website == "" {
		return nil, fmt.Errorf("empty website URL")
	}

	fmt.Printf("   🌐 Fetching: %s\n", event.Website)

	var bodyHTML string
	var err error

	if strings.ToLower(event.Platform) == "echai" {
		// Use headless Chrome for eChai — bypasses Cloudflare bot detection
		bodyHTML, err = s.fetchWithChrome(ctx, event.Website)
		if err != nil {
			return nil, fmt.Errorf("chrome fetch failed: %w", err)
		}
	} else {
		var bodyBytes []byte
		bodyBytes, err = s.fetchURL(ctx, event.Website)
		if err != nil {
			return nil, err
		}
		bodyBytes = sanitizeForPostgres(bodyBytes)
		bodyHTML = string(bodyBytes)
	}

	// Sanitize HTML string for postgres
	bodyHTML = strings.ToValidUTF8(bodyHTML, "")
	bodyHTML = strings.ReplaceAll(bodyHTML, "\x00", "")

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(bodyHTML))
	if err != nil {
		return nil, fmt.Errorf("parse failed: %w", err)
	}

	fmt.Printf("   📄 %d bytes\n", len(bodyHTML))

	var detail *ScrapedDetail
	switch strings.ToLower(event.Platform) {
	case "allevents":
		detail = s.parseAllEventsDetail(doc, event)
	case "hasgeek":
		detail = s.parseHasGeekDetail(doc, event)
	case "meetup":
		detail = s.parseMeetupDetail(doc, event)
	case "townscript":
		detail = s.parseTownscriptDetail(doc, event)
	case "biec":
		detail = s.parseBIECDetail(doc, event)
	case "hitex":
		detail = s.parseHITEXDetail(ctx, doc, event)
	case "echai":
		detail = s.parseEChaiDetail(doc, event)
	default:
		detail = s.parseGenericDetail(doc, event)
	}

	detail.ScrapedBody = truncateString(bodyHTML, 50000)
	fmt.Printf("   ✨ desc=%d chars organizer=%s\n", len(detail.FullDescription), detail.Organizer)
	return detail, nil
}

// fetchWithChrome uses headless Chromium to fully render JavaScript pages.
// This bypasses Cloudflare bot detection because it runs a real browser.
// Chrome/Chromium must be installed on the system.
func (s *DetailScraper) fetchWithChrome(ctx context.Context, targetURL string) (string, error) {
	fmt.Printf("   🌐 Chrome: Launching headless browser for %s\n", targetURL)

	// Create a new Chrome instance with realistic options
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.Flag("exclude-switches", "enable-automation"),
		chromedp.Flag("disable-extensions", false),
		chromedp.Flag("lang", "en-US,en"),
		chromedp.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"),
		chromedp.WindowSize(1280, 800),
	)

	allocCtx, cancelAlloc := chromedp.NewExecAllocator(ctx, opts...)
	defer cancelAlloc()

	chromeCtx, cancelChrome := chromedp.NewContext(allocCtx)
	defer cancelChrome()

	// 30 second timeout for page load
	timeoutCtx, cancelTimeout := context.WithTimeout(chromeCtx, 30*time.Second)
	defer cancelTimeout()

	var htmlContent string

	err := chromedp.Run(timeoutCtx,
		// Navigate to the page
		chromedp.Navigate(targetURL),

		// Wait for the key eChai content element to appear in DOM
		// This ensures JavaScript has fully rendered the page
		chromedp.WaitVisible(`.event_short_description`, chromedp.ByQuery),

		// Small extra wait for any lazy-loaded content
		chromedp.Sleep(1*time.Second),

		// Get the full rendered HTML
		chromedp.OuterHTML("html", &htmlContent, chromedp.ByQuery),
	)

	if err != nil {
		// WaitVisible timed out — content didn't appear, get whatever HTML we have
		fmt.Printf("   ⚠️  Chrome WaitVisible failed (%v), getting raw HTML\n", err)

		// Try getting HTML even if wait failed
		fallbackErr := chromedp.Run(timeoutCtx,
			chromedp.Navigate(targetURL),
			chromedp.Sleep(3*time.Second),
			chromedp.OuterHTML("html", &htmlContent, chromedp.ByQuery),
		)
		if fallbackErr != nil {
			return "", fmt.Errorf("chrome navigation failed: %w", fallbackErr)
		}
	}

	fmt.Printf("   ✅ Chrome: Got %d bytes of rendered HTML\n", len(htmlContent))
	return htmlContent, nil
}

// fetchURL is the standard HTTP fetcher for non-eChai platforms
func (s *DetailScraper) fetchURL(ctx context.Context, targetURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Accept-Encoding", "gzip, deflate, br")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Upgrade-Insecure-Requests", "1")
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "none")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gr, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("gzip failed: %w", err)
		}
		defer gr.Close()
		reader = gr
	}

	return io.ReadAll(reader)
}

// ========== PLATFORM PARSERS ==========

func (s *DetailScraper) parseAllEventsDetail(doc *goquery.Document, event EventFromDB) *ScrapedDetail {
	detail := &ScrapedDetail{EventID: event.ID}

	for _, sel := range []string{".event-description-html", ".event-description", ".description-content", ".about-event"} {
		if html, err := doc.Find(sel).First().Html(); err == nil && len(strings.TrimSpace(html)) > 50 {
			detail.FullDescription = sanitizeHTML(html)
			break
		}
	}

	if img, exists := doc.Find("meta[property='og:image']").First().Attr("content"); exists {
		detail.ImageURL = img
	}
	detail.Organizer = cleanText(doc.Find(".organizer-name, .event-organizer, [itemprop='organizer']").First().Text())

	if regLink, exists := doc.Find("a.register-button, a.book-ticket, a[href*='register']").First().Attr("href"); exists {
		detail.RegistrationURL = absoluteURL(event.Website, regLink)
	} else {
		detail.RegistrationURL = event.Website
	}

	var tags []string
	doc.Find(".event-tags a, .tag, .category-tag").Each(func(_ int, el *goquery.Selection) {
		if tag := cleanText(el.Text()); tag != "" && len(tag) < 50 {
			tags = append(tags, tag)
		}
	})
	if len(tags) > 0 {
		detail.Tags = strings.Join(tags, ", ")
	}
	return detail
}

func (s *DetailScraper) parseHasGeekDetail(doc *goquery.Document, event EventFromDB) *ScrapedDetail {
	detail := &ScrapedDetail{EventID: event.ID}

	for _, sel := range []string{".markdown", ".event__description", "article.markdown"} {
		if html, err := doc.Find(sel).First().Html(); err == nil && len(strings.TrimSpace(html)) > 50 {
			detail.FullDescription = sanitizeHTML(html)
			break
		}
	}

	if img, exists := doc.Find("meta[property='og:image']").First().Attr("content"); exists {
		detail.ImageURL = img
	}
	detail.Organizer = cleanText(doc.Find(".profile__fullname, .organizer").First().Text())
	detail.RegistrationURL = event.Website
	return detail
}

func (s *DetailScraper) parseMeetupDetail(doc *goquery.Document, event EventFromDB) *ScrapedDetail {
	detail := &ScrapedDetail{EventID: event.ID}

	for _, sel := range []string{".w-full.break-words", "[data-event-label='event-description']", ".event-description", ".description"} {
		if html, err := doc.Find(sel).First().Html(); err == nil && len(strings.TrimSpace(html)) > 50 {
			detail.FullDescription = sanitizeHTML(html)
			break
		}
	}

	if img, exists := doc.Find("meta[property='og:image']").First().Attr("content"); exists {
		detail.ImageURL = img
	}
	detail.Organizer = cleanText(doc.Find(".groupName, .organizer-name").First().Text())

	plainText := doc.Find(".w-full.break-words").First().Text()
	if m := regexp.MustCompile(`(?i)charges?:\s*Rs\.?\s*(\d+)`).FindStringSubmatch(plainText); len(m) > 1 {
		detail.Price = "₹" + m[1]
	}
	if m := regexp.MustCompile(`(?i)contact\s*us?:\s*(\d{10})`).FindStringSubmatch(plainText); len(m) > 1 {
		detail.OrganizerContact = m[1]
	}

	detail.RegistrationURL = event.Website
	return detail
}

// parseEChaiDetail parses the Chrome-rendered HTML from eChai
func (s *DetailScraper) parseEChaiDetail(doc *goquery.Document, event EventFromDB) *ScrapedDetail {
	detail := &ScrapedDetail{EventID: event.ID}

	// Primary: the trix-content div (fully rendered by Chrome now)
	if html, err := doc.Find(".event_short_description .trix-content").First().Html(); err == nil && len(strings.TrimSpace(html)) > 20 {
		detail.FullDescription = sanitizeHTML(html)
	}

	// Fallback 1: outer container
	if detail.FullDescription == "" {
		if html, err := doc.Find(".event_short_description").First().Html(); err == nil && len(strings.TrimSpace(html)) > 20 {
			detail.FullDescription = sanitizeHTML(html)
		}
	}

	// Fallback 2: article tag
	if detail.FullDescription == "" {
		if html, err := doc.Find("article").First().Html(); err == nil && len(strings.TrimSpace(html)) > 100 {
			detail.FullDescription = sanitizeHTML(html)
		}
	}

	// Fallback 3: og:description meta
	if detail.FullDescription == "" {
		if desc, exists := doc.Find("meta[property='og:description']").First().Attr("content"); exists && strings.TrimSpace(desc) != "" {
			detail.FullDescription = "<p>" + strings.TrimSpace(desc) + "</p>"
			fmt.Printf("   ℹ️  eChai: used og:description fallback\n")
		}
	}

	// Fallback 4: meta description
	if detail.FullDescription == "" {
		if desc, exists := doc.Find("meta[name='description']").First().Attr("content"); exists && strings.TrimSpace(desc) != "" {
			detail.FullDescription = "<p>" + strings.TrimSpace(desc) + "</p>"
			fmt.Printf("   ℹ️  eChai: used meta description fallback\n")
		}
	}

	if detail.FullDescription == "" {
		fmt.Printf("   ⚠️  eChai: all selectors empty\n")
	}

	if img, exists := doc.Find("meta[property='og:image']").First().Attr("content"); exists {
		detail.ImageURL = img
	}

	detail.Organizer = "eChai Ventures"
	detail.RegistrationURL = event.Website
	return detail
}

func (s *DetailScraper) parseBIECDetail(doc *goquery.Document, event EventFromDB) *ScrapedDetail {
	detail := &ScrapedDetail{EventID: event.ID}

	var parts []string
	if html, err := doc.Find(".eve-detail").Parent().Html(); err == nil && len(cleanText(doc.Find(".eve-detail").Parent().Text())) > 10 {
		parts = append(parts, "<h3>Event Details</h3>"+sanitizeHTML(html))
	}
	if html, err := doc.Find(".eve-venue").Parent().Html(); err == nil && len(cleanText(doc.Find(".eve-venue").Parent().Text())) > 10 {
		parts = append(parts, "<h3>Venue</h3>"+sanitizeHTML(html))
	}
	detail.FullDescription = strings.Join(parts, "\n")

	orgSec := doc.Find(".eve-org").Parent()
	detail.Organizer = cleanText(orgSec.Find("p b").First().Text())
	if detail.Organizer == "" {
		detail.Organizer = "BIEC - Bangalore International Exhibition Centre"
	}
	if email, exists := orgSec.Find("a[href^='mailto:']").First().Attr("href"); exists {
		detail.OrganizerContact = strings.TrimPrefix(email, "mailto:")
	}

	if img, exists := doc.Find("meta[property='og:image']").First().Attr("content"); exists {
		detail.ImageURL = img
	}
	detail.RegistrationURL = event.Website
	return detail
}

// parseHITEXDetail follows the external "Website" button to the organizer page
func (s *DetailScraper) parseHITEXDetail(ctx context.Context, doc *goquery.Document, event EventFromDB) *ScrapedDetail {
	detail := &ScrapedDetail{
		EventID:         event.ID,
		Organizer:       "HITEX - Hyderabad International Trade Expositions",
		RegistrationURL: event.Website,
	}

	if img, exists := doc.Find("meta[property='og:image']").First().Attr("content"); exists {
		detail.ImageURL = img
	}

	externalURL := ""
	doc.Find("a.btn").Each(func(_ int, el *goquery.Selection) {
		if strings.Contains(strings.ToLower(strings.TrimSpace(el.Text())), "website") {
			if href, exists := el.Attr("href"); exists && strings.HasPrefix(href, "http") {
				externalURL = href
			}
		}
	})

	if externalURL == "" {
		for _, sel := range []string{".event-description", ".content", "article", "main"} {
			if html, err := doc.Find(sel).First().Html(); err == nil && len(strings.TrimSpace(html)) > 100 {
				detail.FullDescription = sanitizeHTML(html)
				break
			}
		}
		return detail
	}

	fmt.Printf("   🔗 HITEX: Following external URL: %s\n", externalURL)
	detail.ExternalURL = externalURL
	time.Sleep(2 * time.Second)

	extBytes, err := s.fetchURL(ctx, externalURL)
	if err != nil {
		fmt.Printf("   ⚠️  HITEX external fetch failed: %v\n", err)
		return detail
	}

	extBytes = sanitizeForPostgres(extBytes)

	extDoc, err := goquery.NewDocumentFromReader(strings.NewReader(string(extBytes)))
	if err != nil {
		fmt.Printf("   ⚠️  HITEX external parse failed: %v\n", err)
		return detail
	}

	fmt.Printf("   📄 HITEX external: %d bytes\n", len(extBytes))

	for _, sel := range []string{
		"section.section", ".about-event", "[class*='about']",
		".event-description", ".event-content", "article", "main",
	} {
		if html, err := extDoc.Find(sel).First().Html(); err == nil && len(strings.TrimSpace(html)) > 100 {
			detail.FullDescription = sanitizeHTML(html)
			break
		}
	}

	if detail.FullDescription == "" {
		var pParts []string
		extDoc.Find("p").Each(func(_ int, p *goquery.Selection) {
			if text := strings.TrimSpace(p.Text()); len(text) > 50 {
				pParts = append(pParts, "<p>"+text+"</p>")
			}
		})
		detail.FullDescription = strings.Join(pParts, "\n")
	}

	if detail.ImageURL == "" {
		if img, exists := extDoc.Find("meta[property='og:image']").First().Attr("content"); exists {
			detail.ImageURL = img
		}
	}

	return detail
}

func (s *DetailScraper) parseTownscriptDetail(doc *goquery.Document, event EventFromDB) *ScrapedDetail {
	detail := &ScrapedDetail{EventID: event.ID}

	for _, sel := range []string{".event-description-text", ".description-content"} {
		if html, err := doc.Find(sel).First().Html(); err == nil && len(strings.TrimSpace(html)) > 50 {
			detail.FullDescription = sanitizeHTML(html)
			break
		}
	}

	if img, exists := doc.Find("meta[property='og:image']").First().Attr("content"); exists {
		detail.ImageURL = img
	} else if img, exists := doc.Find(".event-image img, .banner img").First().Attr("src"); exists {
		detail.ImageURL = absoluteURL(event.Website, img)
	}

	detail.Organizer = cleanText(doc.Find(".organizer-info, .organizer-name, .host").First().Text())
	detail.RegistrationURL = event.Website
	return detail
}

func (s *DetailScraper) parseGenericDetail(doc *goquery.Document, event EventFromDB) *ScrapedDetail {
	detail := &ScrapedDetail{EventID: event.ID}

	for _, sel := range []string{
		".event-description", ".description", ".content", "article",
		"[itemprop='description']", ".about", ".details", "main",
		".event-content", ".event-details", ".event-info",
	} {
		if html, err := doc.Find(sel).First().Html(); err == nil && len(strings.TrimSpace(html)) > 100 {
			detail.FullDescription = sanitizeHTML(html)
			break
		}
	}

	if img, exists := doc.Find("meta[property='og:image']").First().Attr("content"); exists {
		detail.ImageURL = img
	}
	detail.Organizer = cleanText(doc.Find(".organizer, .author, [itemprop='organizer']").First().Text())
	detail.RegistrationURL = event.Website
	return detail
}

// ========== SANITIZERS ==========

// sanitizeForPostgres removes invalid UTF-8 AND null bytes (0x00).
// PostgreSQL TEXT columns reject 0x00 even though it's valid UTF-8.
func sanitizeForPostgres(b []byte) []byte {
	s := strings.ToValidUTF8(string(b), "")
	s = strings.ReplaceAll(s, "\x00", "")
	return []byte(s)
}

// sanitizeHTML strips scripts/styles/iframes, keeps formatting tags.
// Output is safe for dangerouslySetInnerHTML in React.
func sanitizeHTML(html string) string {
	html = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`).ReplaceAllString(html, "")
	html = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`).ReplaceAllString(html, "")
	html = regexp.MustCompile(`(?is)<iframe[^>]*>.*?</iframe>`).ReplaceAllString(html, "")
	html = regexp.MustCompile(`(?is)<noscript[^>]*>.*?</noscript>`).ReplaceAllString(html, "")
	html = regexp.MustCompile(`(?i)\s+on\w+="[^"]*"`).ReplaceAllString(html, "")
	html = regexp.MustCompile(`(?i)href="javascript:[^"]*"`).ReplaceAllString(html, `href="#"`)
	html = regexp.MustCompile(`>\s{3,}<`).ReplaceAllString(html, "><")
	html = strings.ReplaceAll(html, "\x00", "")
	return strings.TrimSpace(html)
}

// ========== HELPERS ==========

func cleanText(s string) string {
	s = strings.TrimSpace(s)
	return regexp.MustCompile(`\s+`).ReplaceAllString(s, " ")
}

func cleanHTML(html string) string {
	html = regexp.MustCompile(`(?s)<script[^>]*>.*?</script>`).ReplaceAllString(html, "")
	html = regexp.MustCompile(`(?s)<style[^>]*>.*?</style>`).ReplaceAllString(html, "")
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(html, " "))
}

func absoluteURL(base, href string) string {
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
		re := regexp.MustCompile(`^(https?://[^/]+)`)
		if m := re.FindStringSubmatch(base); len(m) > 1 {
			return m[1] + href
		}
	}
	return href
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}

func randomInt(max int) int {
	return int(time.Now().UnixNano() % int64(max))
}

func extractNumber(s string) int {
	re := regexp.MustCompile(`\d+`)
	if m := re.FindString(s); m != "" {
		var n int
		fmt.Sscanf(m, "%d", &n)
		return n
	}
	return 0
}
