package scrapers

import (
	"bytes"
	"context"
	"event-scraper/internal/models"
	"fmt"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
)

const (
	townscriptBaseURL = "https://www.townscript.com"

	townscriptIndiaTech = "https://www.townscript.com/in/india/tech?page=%d"

	townscriptMaxPages      = 25
	townscriptMaxEmptyPages = 2

	townscriptMinHTMLSize   = 8000
	townscriptPoliteDelayMS = 500
)

type TownscriptScraper struct {
	*BaseScraper
}

func NewTownscriptScraper(timeout time.Duration, retries int) *TownscriptScraper {
	return &TownscriptScraper{BaseScraper: NewBaseScraper(timeout, retries)}
}

func (s *TownscriptScraper) Name() string { return "townscript" }

func (s *TownscriptScraper) Scrape(ctx context.Context) ([]models.Event, error) {
	var all []models.Event
	seen := map[string]bool{}
	emptyStreak := 0

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"),
		chromedp.WindowSize(1280, 900),
	)

	allocCtx, cancelAlloc := chromedp.NewExecAllocator(ctx, opts...)
	defer cancelAlloc()

	chromeCtx, cancelChrome := chromedp.NewContext(allocCtx)
	defer cancelChrome()

	_ = chromedp.Run(chromeCtx, chromedp.Navigate("about:blank"))

	for page := 1; page <= townscriptMaxPages; page++ {
		select {
		case <-ctx.Done():
			return all, ctx.Err()
		default:
		}

		url := fmt.Sprintf(townscriptIndiaTech, page)
		evs, err := s.scrapePage(ctx, chromeCtx, url, seen)
		if err != nil {
			fmt.Printf("Townscript [page=%d] error: %v\n", page, err)
			emptyStreak++
			if emptyStreak >= townscriptMaxEmptyPages {
				break
			}
			continue
		}

		if len(evs) == 0 {
			emptyStreak++
			if emptyStreak >= townscriptMaxEmptyPages {
				break
			}
		} else {
			emptyStreak = 0
			all = append(all, evs...)
		}

		time.Sleep(time.Duration(townscriptPoliteDelayMS) * time.Millisecond)
	}

	fmt.Printf("Townscript: Found %d upcoming offline events\n", len(all))
	return all, nil
}

func (s *TownscriptScraper) scrapePage(ctx context.Context, chromeCtx context.Context, url string, seen map[string]bool) ([]models.Event, error) {
	html, err := s.fetchHTMLWithChrome(ctx, chromeCtx, url)
	if err != nil {
		return nil, fmt.Errorf("chrome render failed: %w", err)
	}
	fmt.Printf("Townscript: Chrome rendered %d bytes\n", len(html))

	events, err := s.parseHTML(html, seen)
	if err != nil {
		return nil, err
	}

	fmt.Printf("Townscript: Parsed %d events from %s\n", len(events), url)
	return events, nil
}

func (s *TownscriptScraper) fetchHTMLWithChrome(ctx context.Context, chromeCtx context.Context, url string) (string, error) {
	pageCtx, cancel := context.WithTimeout(chromeCtx, 35*time.Second)
	defer cancel()

	var htmlContent string

	err := chromedp.Run(pageCtx,
		chromedp.Navigate(url),
		chromedp.ActionFunc(func(ctx context.Context) error {
			deadline := time.Now().Add(15 * time.Second)
			for time.Now().Before(deadline) {
				var count int
				err := chromedp.Evaluate(`document.querySelectorAll("a[href*='/e/']").length`, &count).Do(ctx)
				if err == nil && count > 0 {
					return nil
				}
				time.Sleep(500 * time.Millisecond)
			}
			return nil
		}),
		chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight / 2)`, nil),
		chromedp.Sleep(500*time.Millisecond),
		chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight)`, nil),
		chromedp.Sleep(500*time.Millisecond),
		chromedp.OuterHTML("html", &htmlContent),
	)
	if err != nil {
		return "", fmt.Errorf("chromedp.Run: %w", err)
	}
	return htmlContent, nil
}

func (s *TownscriptScraper) parseHTML(html string, seen map[string]bool) ([]models.Event, error) {
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader([]byte(html)))
	if err != nil {
		return nil, err
	}

	var events []models.Event

	totalAnchors := doc.Find("a[href]").Length()
	eAnchors := doc.Find("a[href*='/e/']").Length()
	fmt.Printf("Townscript: DEBUG total anchors=%d, /e/ anchors=%d\n", totalAnchors, eAnchors)

	doc.Find("div.ls-card a[href^='/e/']").Each(func(_ int, a *goquery.Selection) {
		if ev := s.extractEvent(a, seen); ev != nil {
			events = append(events, *ev)
		}
	})

	if len(events) == 0 {
		doc.Find("a[href*='townscript.com/e/'], a[href^='/e/']").Each(func(_ int, a *goquery.Selection) {
			if ev := s.extractEvent(a, seen); ev != nil {
				events = append(events, *ev)
			}
		})
	}

	if len(events) == 0 {
		doc.Find("ts-listings-event-card").Each(func(_ int, card *goquery.Selection) {
			a := card.ParentsFiltered("a[href]").First()
			if a.Length() == 0 {
				a = card.Find("a[href]").First()
			}
			if ev := s.extractEvent(a, seen); ev != nil {
				events = append(events, *ev)
			}
		})
	}

	if len(events) == 0 {
		doc.Find("a[href*='/e/']").Each(func(_ int, a *goquery.Selection) {
			if ev := s.extractEvent(a, seen); ev != nil {
				events = append(events, *ev)
			}
		})
	}

	return events, nil
}

func (s *TownscriptScraper) extractEvent(a *goquery.Selection, seen map[string]bool) *models.Event {
	href, ok := a.Attr("href")
	if !ok || href == "" {
		return nil
	}

	website := normalizeTownscriptURL(href)
	if website == "" || seen[website] {
		return nil
	}

	// ── Title ─────────────────────────────────────────────────────────────────
	title := tsCleaned(a.Find(".event-name").First().Text())
	if title == "" {
		title = tsCleaned(a.Find(".event-name-box").First().Text())
	}
	if title == "" {
		title = tsCleaned(a.Find("[class*='event-name']").First().Text())
	}
	if title == "" {
		title = tsCleaned(a.Find("h1, h2, h3, h4, strong").First().Text())
	}
	if title == "" {
		title = tsFirstLine(tsCleaned(a.Text()))
	}
	if len(title) < 3 {
		return nil
	}

	// ── Non-event filter (training, real estate, etc.) ────────────────────────
	if isTownscriptNonEvent(title) {
		fmt.Printf("Townscript: [FILTER-NONEVENT] %q\n", title)
		return nil
	}

	// ── Tech relevance check — must have at least one tech/community signal ───
	if !hasTechSignal(title) {
		fmt.Printf("Townscript: [FILTER-NOTECH] %q\n", title)
		return nil
	}

	// ── Date ─────────────────────────────────────────────────────────────────
	date := tsCleaned(a.Find(".secondary-details .date").First().Text())
	if date == "" {
		date = tsCleaned(a.Find("[class*='date'], time, [class*='time']").First().Text())
	}

	// ── Location ─────────────────────────────────────────────────────────────
	location := tsCleaned(a.Find(".secondary-details .location").First().Text())
	if location == "" {
		location = tsCleaned(a.Find("[class*='location'], [class*='venue'], [class*='city']").First().Text())
	}
	if location == "" {
		location = "India"
	}

	// ── Date filter ───────────────────────────────────────────────────────────
	dateLower := strings.ToLower(strings.TrimSpace(date))
	if dateLower != "daily" && dateLower != "" {
		if !isUpcomingTownscript(date) {
			fmt.Printf("Townscript: [FILTER-DATE] %q date=%q\n", title, date)
			return nil
		}
	}

	// ── Offline filter ────────────────────────────────────────────────────────
	locationLower := strings.ToLower(location)
	titleLower := strings.ToLower(title)
	if strings.Contains(locationLower, "online") ||
		strings.Contains(locationLower, "virtual") ||
		strings.Contains(titleLower, "online") ||
		strings.Contains(titleLower, "virtual") ||
		strings.Contains(titleLower, "webinar") {
		fmt.Printf("Townscript: [FILTER-ONLINE] %q\n", title)
		return nil
	}

	seen[website] = true
	return &models.Event{
		EventName: title,
		Location:  location,
		Address:   "",
		Date:      date,
		Website:   website,
		EventType: "Offline",
		Platform:  "townscript",
	}
}

// isTownscriptNonEvent blocks titles that are clearly not tech community events.
// Covers: training/courses, real estate/property, machinery, medical, finance spam.
func isTownscriptNonEvent(title string) bool {
	t := strings.ToLower(tsCleaned(title))

	blocklist := []string{
		// ── Training / education ──────────────────────────────────────────────
		"training", "course", "classes", "coaching",
		"academy", "institute", "institution",
		"certification", "certificate",
		"bootcamp", "internship", "admission",
		"tuition", "placement", "job guarantee",
		"ielts", "toefl", "spoken english",

		// ── Real estate / property ────────────────────────────────────────────
		"apartment", "apartments", "flat", "flats", "villa", "villas",
		"plot", "plots", "property", "properties",
		"real estate", "realty", "housing", "residence", "residences",
		"residential", "township", "township",
		"bhk", "floor plan", "floor plans",
		"sqft", "sq ft", "square feet",
		"possession", "pre-launch", "prelaunch",
		"rera", "ready to move",
		"premium living", "luxury living", "luxury homes", "dream home",
		"modern living", "modern homes",
		"godrej", "brigade", "sobha", "prestige", "puravankara",
		"lodha", "mahindra lifespace", "assetz", "embassy",
		"kolte patil", "rustomjee", "shapoorji",
		"sarjapur road", "whitefield", "hebbal", "yelahanka",
		"chandapura", "kaikondrahalli", "jakkur", "devanahalli",
		"unveiling", "launch price", "site visit",

		// ── Industrial / machinery ────────────────────────────────────────────
		"machine", "machinery", "equipment", "blasting",
		"manufacturing", "industrial",

		// ── Medical / health sales ────────────────────────────────────────────
		"hospital", "clinic", "pharma", "medicine", "wellness spa",

		// ── Financial products ────────────────────────────────────────────────
		"insurance", "mutual fund", "loan",
	}

	for _, kw := range blocklist {
		if strings.Contains(t, kw) {
			return true
		}
	}
	return false
}

// hasTechSignal returns true only if the title contains at least one keyword
// associated with genuine tech/startup/community events.
// This is the second gate — even if a title passes the blocklist, it must
// show a positive tech signal to be included.
func hasTechSignal(title string) bool {
	t := strings.ToLower(tsCleaned(title))

	techSignals := []string{
		// ── Event formats ─────────────────────────────────────────────────────
		"meetup", "meet-up", "conference", "summit", "hackathon",
		"workshop", "webinar", "seminar", "expo", "conclave",
		"fest", "festival", "fair", "demo day", "demo", "pitch",
		"bootcamp", "sprint", "unconference", "barcamp",
		"networking", "mixer", "connect", "community",

		// ── Tech domains ──────────────────────────────────────────────────────
		"tech", "technology", "software", "hardware", "developer",
		"startup", "entrepreneur", "innovation", "digital",
		"ai", "artificial intelligence", "machine learning", "ml",
		"data", "cloud", "devops", "blockchain", "web3",
		"cybersecurity", "security", "iot", "internet of things",
		"product", "design", "ux", "ui", "agile", "scrum",
		"open source", "github", "api", "saas", "fintech",
		"edtech", "healthtech", "hrtech", "legaltech",
		"robotics", "automation", "ar", "vr", "metaverse",
		"mobile", "android", "ios", "flutter", "react",
		"python", "javascript", "golang", "java", "devrel",

		// ── Investor / business ───────────────────────────────────────────────
		"investor", "investment", "venture", "vc", "angel",
		"founders", "cto", "ceo", "leadership",
	}

	for _, signal := range techSignals {
		if strings.Contains(t, signal) {
			return true
		}
	}
	return false
}

// isUpcomingTownscript checks if a Townscript date string is in the future.
func isUpcomingTownscript(date string) bool {
	if date == "" {
		return true
	}
	now := time.Now()

	months := map[string]time.Month{
		"jan": time.January, "feb": time.February, "mar": time.March,
		"apr": time.April, "may": time.May, "jun": time.June,
		"jul": time.July, "aug": time.August, "sep": time.September,
		"oct": time.October, "nov": time.November, "dec": time.December,
	}

	parts := strings.Fields(date)
	if len(parts) >= 2 {
		mon, ok := months[strings.ToLower(parts[0])[:3]]
		if ok {
			var day int
			fmt.Sscanf(parts[1], "%d", &day)
			if day > 0 {
				t := time.Date(now.Year(), mon, day, 0, 0, 0, 0, now.Location())
				if t.Before(now.AddDate(0, -1, 0)) {
					t = t.AddDate(1, 0, 0)
				}
				return !t.Before(now.Truncate(24 * time.Hour))
			}
		}
	}

	return true
}

func normalizeTownscriptURL(href string) string {
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	if strings.HasPrefix(href, "https://") || strings.HasPrefix(href, "http://") {
		return href
	}
	if strings.HasPrefix(href, "//") {
		return "https:" + href
	}
	if strings.HasPrefix(href, "/") {
		return townscriptBaseURL + href
	}
	if strings.Contains(href, "townscript.com") {
		return "https://" + href
	}
	return ""
}

func tsCleaned(s string) string {
	s = strings.ReplaceAll(s, "\u00a0", " ")
	return strings.Join(strings.Fields(s), " ")
}

func tsFirstLine(s string) string {
	s = tsCleaned(s)
	if len(s) > 120 {
		return strings.TrimSpace(s[:120])
	}
	return s
}