package scrapers

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"event-scraper/internal/models"
	"event-scraper/pkg/utils"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/andybalholm/brotli"
)

const (
	allEventsBase = "https://allevents.in"

	// Only use the canonical link user provided:
	// https://allevents.in/{city}/{category}?ref=category-list-modal
	allEventsRefParam = "category-list-modal"

	// Hard cap to avoid infinite loops / too many requests
	allEventsMaxPages = 12

	// Per request timeout so we don't get "stuck for minutes"
	allEventsPerRequestTimeout = 45 * time.Second
)

var allEventsCategories = []string{
	"technology",
}

var userAgents = []string{
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
}

var allEventsLayouts = []string{
	"Mon, 2 Jan 2006 3:04 PM",
	"Mon, 02 Jan 2006 3:04 PM",
	"Mon, 2 Jan 2006 15:04",
	"2006-01-02T15:04:05Z07:00",
	"2006-01-02T15:04:05",
	"2006-01-02",
}

var techTitleKeywords = []string{
	"tech", "technology", "digital", "software", "hardware", "iot",
	"automation", "robotics", "ai ", " ai,", "artificial intelligence",
	"machine learning", "data", "cyber", "cloud", "semiconductor",
	"electronic", "electrical", "ev ", "electric vehicle", "solar",
	"energy", "engineering", "manufacturing", "industrial", "machinery",
	"tool", "lab", "biotech", "pharma", "logistics", "warehouse",
	"print", "smart", "startup", "innovation", "hackathon", "devops",
	"blockchain", "web3", "developer", "coding", "programming", "summit",
	"conference", "expo", "symposium", "workshop", "seminar",
	"arduino", "raspberry", "embedded", "firmware", "microcontroller",
	"5g", "quantum", "satellite", "drone", "autonomous", "fintech",
	"healthtech", "edtech", "saas", "api", "open source",
	 "meetup", "connect", "networking", "fest", "conclave", "forum",
    "bootcamp", "sprint", "demo day", "pitch", "product", "devfest",
    "google i/o", "aws", "azure", "kubernetes", "docker", "linux",
    "python", "javascript", "golang", "java", "react", "node",
    "database", "security", "infosec", "pentest", "open source",
    "makers", "iot", "build", "launch", "product hunt",
    "3d printing", "cad", "simulation", "robotics", "stem",
}

var nonTechKeywords = []string{
	"yoga", "fitness", "gym", "zumba", "dance", "salsa", "ballet",
	"music", "concert", "dj ", "band", "karaoke", "singing",
	"painting", "art exhibition", "sculpture", "photography walk",
	"film screening", "movie", "theatre", "drama", "comedy show",
	"food festival", "culinary", "wine tasting", "beer fest",
	"fashion show", "beauty", "makeup", "skincare",
	"wedding", "bridal", "matrimony", "dating",
	"meditation", "spiritual", "prayer", "puja", "bhajan", "kirtan",
	"cricket", "football", "marathon", "cyclothon", "swimming",
	"real estate property", "astrology", "tarot", "numerology",
	"kids crafts", "parenting workshop",
}

type AllEventsScraper struct {
	*BaseScraper
	cities  []string
	uaIndex int
}

func NewAllEventsScraper(timeout time.Duration, retries int) *AllEventsScraper {
	return &AllEventsScraper{
		BaseScraper: NewBaseScraper(timeout, retries),
		cities: []string{
			"bangalore", "mumbai", "delhi", "hyderabad", "chennai",
			"pune-in", "kolkata", "ahmedabad",
		},
	}
}

func (s *AllEventsScraper) Name() string { return "allevents" }

func (s *AllEventsScraper) Scrape(ctx context.Context) ([]models.Event, error) {
	var all []models.Event
	seen := make(map[string]bool)

	for _, city := range s.cities {
		for _, category := range allEventsCategories {
			select {
			case <-ctx.Done():
				return all, ctx.Err()
			case <-time.After(time.Duration(5+utils.RandomInt(5)) * time.Second):
			}

			evs, err := s.scrapeCityCategoryWithViewMore(ctx, city, category)
			if err != nil {
				fmt.Printf("AllEvents [%s/%s]: %v\n", city, category, err)
				continue
			}

			for _, e := range evs {
				k := strings.TrimSpace(e.Website)
				if k == "" {
					k = e.EventName + "|" + e.DateTime
				}
				if !seen[k] {
					seen[k] = true
					all = append(all, e)
				}
			}
		}
	}

	fmt.Printf("AllEvents: Found %d unique upcoming events\n", len(all))
	return all, nil
}

// ✅ Correct approach:
// 1) GET the exact user URL: /{city}/{category}?ref=category-list-modal
// 2) Parse first batch of <li class="event-card event-card-link" data-link="...">
// 3) Then load more using the "View More" internal endpoint (XHR) repeatedly.
//    Because "View More" is not another HTML page. It's dynamic load.
func (s *AllEventsScraper) scrapeCityCategoryWithViewMore(ctx context.Context, city, category string) ([]models.Event, error) {
	ua := userAgents[s.uaIndex%len(userAgents)]
	s.uaIndex++

	listURL := buildCanonicalListingURL(city, category)

	// ---- page 1 html ----
	doc, bodyBytes, err := s.fetchDocAndBytes(ctx, listURL, ua)
	if err != nil {
		return nil, err
	}

	var collected []models.Event
	collected = append(collected, parseAllEventsEventCards(doc, city)...)

	// ---- now "view more" ----
	// The "View More" uses internal JSON endpoint which returns HTML fragment or JSON.
	// We detect the correct endpoint by scanning the page HTML/JS for /api/events/list or similar.
	// If not found, we fall back to the known endpoint used by AllEvents currently.
	endpoint := detectViewMoreEndpoint(string(bodyBytes))
	if endpoint == "" {
		// fallback: this is the common endpoint used by "View More"
		endpoint = "https://allevents.in/api/events/list"
	}

	// Page counter for view-more
	for page := 2; page <= allEventsMaxPages; page++ {
		select {
		case <-ctx.Done():
			return collected, ctx.Err()
		case <-time.After(time.Duration(1+utils.RandomInt(2)) * time.Second):
		}

		moreDoc, n, err := s.fetchViewMorePage(ctx, endpoint, city, category, page, ua, listURL)
		if err != nil {
			// stop when blocked / no more data
			break
		}
		if n == 0 || moreDoc == nil {
			break
		}

		evs := parseAllEventsEventCards(moreDoc, city)
		if len(evs) == 0 {
			break
		}
		collected = append(collected, evs...)

		// heuristic: if returned fewer cards than typical, likely end
		if len(evs) < 5 {
			break
		}
	}

	collected = filterAndNormalize(collected, city)
	return dedupeByWebsite(collected), nil
}

func buildCanonicalListingURL(city, category string) string {
	return fmt.Sprintf("%s/%s/%s?ref=%s", allEventsBase, city, category, allEventsRefParam)
}

func (s *AllEventsScraper) fetchDocAndBytes(ctx context.Context, urlStr, ua string) (*goquery.Document, []byte, error) {
	reqCtx, cancel := context.WithTimeout(ctx, allEventsPerRequestTimeout)
	defer cancel()

	resp, err := s.FetchWithRetry(reqCtx, urlStr)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	body, err := readAndDecodeAny(resp)
	if err != nil {
		return nil, nil, err
	}

	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, nil, err
	}
	return doc, body, nil
}

// "View More" payload fetcher. This uses the site's internal pagination.
func (s *AllEventsScraper) fetchViewMorePage(
	ctx context.Context,
	endpoint, city, category string,
	page int,
	ua, referer string,
) (*goquery.Document, int, error) {

	// payload as the site expects (what the button triggers)
	payload, _ := json.Marshal(map[string]any{
		"city":       city,
		"category":   category,
		"page":       page,
		"rows":       20,
		"event_type": "upcoming",
	})

	reqCtx, cancel := context.WithTimeout(ctx, allEventsPerRequestTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "POST", endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, 0, err
	}

	req.Header.Set("Content-Type", "application/json;charset=UTF-8")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Origin", allEventsBase)
	req.Header.Set("Referer", referer)
	req.Header.Set("User-Agent", ua)
	req.Header.Set("X-Requested-With", "XMLHttpRequest")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, 0, fmt.Errorf("view more http %d", resp.StatusCode)
	}

	body, err := readAndDecodeAny(resp)
	if err != nil {
		return nil, 0, err
	}

	// If we got HTML, bot-check, etc.
	trim := bytes.TrimSpace(body)
	if len(trim) > 0 && trim[0] == '<' {
		// Sometimes it returns HTML directly
		doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
		if err != nil {
			return nil, 0, err
		}
		return doc, countCards(doc), nil
	}

	// Usually JSON like: {"error":0,"data":[...]} OR {"error":0,"html":"<li>...</li>"}
	var parsed map[string]any
	if err := json.Unmarshal(body, &parsed); err != nil {
		// some deployments return plain HTML fragment
		doc, derr := goquery.NewDocumentFromReader(bytes.NewReader(body))
		if derr != nil {
			return nil, 0, err
		}
		return doc, countCards(doc), nil
	}

	// error?
	if ev, ok := parsed["error"].(float64); ok && int(ev) != 0 {
		return nil, 0, fmt.Errorf("view more api error=%d", int(ev))
	}

	// if "html" exists, parse it as document fragment
	if htmlStr, ok := parsed["html"].(string); ok && strings.TrimSpace(htmlStr) != "" {
		doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlStr))
		if err != nil {
			return nil, 0, err
		}
		return doc, countCards(doc), nil
	}

	// If "data" is an array of objects, we can't directly parse cards from it (needs mapping).
	// But many setups include event_url/eventname. We'll convert that to synthetic HTML so our parser works.
	if data, ok := parsed["data"].([]any); ok && len(data) > 0 {
		var sb strings.Builder
		for _, row := range data {
			m, _ := row.(map[string]any)
			name, _ := m["eventname"].(string)
			start, _ := m["start_time_display"].(string)
			loc, _ := m["location"].(string)
			link, _ := m["event_url"].(string)
			if strings.TrimSpace(link) == "" {
				continue
			}
			sb.WriteString(`<li class="event-card event-card-link" data-link="`)
			sb.WriteString(htmlEscape(absoluteURLAllEvents(link)))
			sb.WriteString(`">`)
			sb.WriteString(`<div class="meta"><div class="meta-top"><div class="date">`)
			sb.WriteString(htmlEscape(start))
			sb.WriteString(`</div></div><div class="meta-middle"><div class="title"><h3>`)
			sb.WriteString(htmlEscape(name))
			sb.WriteString(`</h3></div><div class="location">`)
			sb.WriteString(htmlEscape(loc))
			sb.WriteString(`</div></div></div></li>`)
		}
		doc, err := goquery.NewDocumentFromReader(strings.NewReader(sb.String()))
		if err != nil {
			return nil, 0, err
		}
		return doc, countCards(doc), nil
	}

	return nil, 0, nil
}

func countCards(doc *goquery.Document) int {
	return doc.Find("li.event-card.event-card-link[data-link]").Length()
}

// best-effort endpoint detection from inline JS (optional)
var viewMoreEndpointRe = regexp.MustCompile(`https://allevents\.in/api/events/list`)

func detectViewMoreEndpoint(pageHTML string) string {
	if viewMoreEndpointRe.MatchString(pageHTML) {
		return "https://allevents.in/api/events/list"
	}
	return ""
}

// decode gzip/br
func readAndDecodeAny(resp *http.Response) ([]byte, error) {
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	enc := strings.ToLower(strings.TrimSpace(resp.Header.Get("Content-Encoding")))
	switch enc {
	case "br":
		r := brotli.NewReader(bytes.NewReader(raw))
		return io.ReadAll(r)
	case "gzip":
		gr, err := gzip.NewReader(bytes.NewReader(raw))
		if err != nil {
			return nil, err
		}
		defer gr.Close()
		return io.ReadAll(gr)
	default:
		return raw, nil
	}
}

// parses cards you showed
func parseAllEventsEventCards(doc *goquery.Document, city string) []models.Event {
	var events []models.Event

	doc.Find("li.event-card.event-card-link[data-link]").Each(func(_ int, el *goquery.Selection) {
		dataLink, ok := el.Attr("data-link")
		if !ok || strings.TrimSpace(dataLink) == "" {
			return
		}

		title := strings.TrimSpace(el.Find("div.title h3").First().Text())
		if title == "" {
			title = strings.TrimSpace(el.Find("div.title a").First().Text())
		}
		if len(title) < 3 {
			return
		}

		dateStr := strings.TrimSpace(el.Find("div.date").First().Text())
		location := strings.TrimSpace(el.Find("div.location").First().Text())
		if location == "" {
			location = city
		}

		events = append(events, models.Event{
			EventName:   title,
			DateTime:    dateStr,
			Location:    location,
			Address:     "",
			Website:     absoluteURLAllEvents(dataLink),
			Description: "",
			EventType:   "Offline",
			Platform:    "allevents",
		})
	})

	return events
}

func filterAndNormalize(in []models.Event, fallbackCity string) []models.Event {
	out := make([]models.Event, 0, len(in))
	for _, e := range in {
		name := strings.TrimSpace(e.EventName)
		if name == "" {
			continue
		}
		loc := strings.TrimSpace(e.Location)
		if loc == "" {
			loc = fallbackCity
		}

		if isOnlineLocation(loc) {
			continue
		}
		if !isTechRelevant(name) {
			continue
		}
		if !isAllEventsUpcoming(e.DateTime) {
			continue
		}

		e.EventName = name
		e.Location = loc
		e.Website = absoluteURLAllEvents(e.Website)
		e.EventType = "Offline"
		e.Platform = "allevents"
		out = append(out, e)
	}
	return out
}

func isAllEventsUpcoming(dateStr string) bool {
	if strings.TrimSpace(dateStr) == "" {
		return true
	}
	if strings.Contains(strings.ToLower(dateStr), "onwards") {
		return true
	}

	now := time.Now()
	normalized := normalizeAllEventsDate(dateStr)

	for _, layout := range allEventsLayouts {
		if t, err := time.Parse(layout, normalized); err == nil {
			return !t.Before(now.Truncate(24 * time.Hour))
		}
	}
	for _, layout := range allEventsLayouts {
		if t, err := time.Parse(layout, dateStr); err == nil {
			return !t.Before(now.Truncate(24 * time.Hour))
		}
	}
	return true
}

func normalizeAllEventsDate(s string) string {
	halves := strings.SplitN(s, " - ", 2)
	datePart := strings.TrimSpace(halves[0])
	timePart := ""
	if len(halves) == 2 {
		timePart = strings.TrimSpace(halves[1])
	}

	segments := strings.Split(datePart, ", ")
	if len(segments) == 3 {
		datePart = segments[0] + ", " + segments[1] + " " + segments[2]
	}

	if timePart != "" {
		return datePart + " " + timePart
	}
	return datePart
}

func isTechRelevant(title string) bool {
	lower := strings.ToLower(title)

	for _, kw := range nonTechKeywords {
		if strings.Contains(lower, kw) {
			return false
		}
	}

	for _, kw := range techTitleKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}

	// ✅ If it doesn't match any tech keyword, treat it as non-tech
	return false
}

func isOnlineLocation(location string) bool {
	lower := strings.ToLower(location)
	onlineMarkers := []string{
		"online", "virtual", "zoom", "webinar", "google meet",
		"microsoft teams", "discord", "youtube live", "livestream",
		"via internet", "web conference", "remote", "anywhere",
	}
	for _, m := range onlineMarkers {
		if strings.Contains(lower, m) {
			return true
		}
	}
	return false
}

var schemeReAllEvents = regexp.MustCompile(`^https?://`)

func absoluteURLAllEvents(href string) string {
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	if schemeReAllEvents.MatchString(href) {
		return href
	}
	if strings.HasPrefix(href, "/") {
		return allEventsBase + href
	}
	return allEventsBase + "/" + href
}

func dedupeByWebsite(in []models.Event) []models.Event {
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

// Very small html escape (enough for our synthetic HTML)
func htmlEscape(s string) string {
	r := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&#39;",
	)
	return r.Replace(s)
}

// ensure valid URL (just safety)
func normalizeURL(u string) string {
	u = strings.TrimSpace(u)
	if u == "" {
		return u
	}
	_, err := url.Parse(u)
	if err != nil {
		return ""
	}
	return u
}
