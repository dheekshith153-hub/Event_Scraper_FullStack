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

func (s *EChaiScraper) Name() string { return "echai" }

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

	doc.Find("div.position-relative.border-bottom.pb-1").Each(func(i int, container *goquery.Selection) {
		// ── Title ──────────────────────────────────────────────────
		title := ""
		if t := container.Find("h6.event-title"); t.Length() > 0 {
			title = strings.TrimSpace(t.Text())
		}
		if title == "" {
			return
		}

		// ── Date ───────────────────────────────────────────────────
		rawDate, _ := container.Attr("data-date")
		date := ""
		if rawDate != "" {
			parts := strings.Split(rawDate, "T")
			if len(parts) > 0 {
				date = parts[0]
			}
		}
		if !utils.IsUpcoming(date) {
			return
		}

		// ── Website link ────────────────────────────────────────────
		website := ""
		if a := container.Find("a.stretched-link"); a.Length() > 0 {
			if href, ok := a.Attr("href"); ok {
				website = resolveURL(baseURL, href)
			}
		}

		// ── Unique image per event ──────────────────────────────────
		// Priority: og/meta image on card → img tag inside container
		// We store the first img src found; the detail scraper will
		// fetch the event page and overwrite with higher-resolution img.
		imageURL := ""

		// 1. img[src] directly inside the card container
		container.Find("img").EachWithBreak(func(_ int, img *goquery.Selection) bool {
			if src, ok := img.Attr("src"); ok && src != "" && !strings.Contains(src, "logo") {
				imageURL = resolveURL(baseURL, src)
				return false // stop after first useful image
			}
			return true
		})

		// 2. CSS background-image on a div (e.g. event poster)
		if imageURL == "" {
			container.Find("[style]").EachWithBreak(func(_ int, el *goquery.Selection) bool {
				style, _ := el.Attr("style")
				if idx := strings.Index(style, "url("); idx >= 0 {
					raw := style[idx+4:]
					end := strings.Index(raw, ")")
					if end > 0 {
						u := strings.Trim(raw[:end], `'"`)
						if u != "" {
							imageURL = resolveURL(baseURL, u)
							return false
						}
					}
				}
				return true
			})
		}

		// ── Location ────────────────────────────────────────────────
		location := ""
		if geo := container.Find("svg.bi-geo"); geo.Length() > 0 {
			if p := geo.Parent(); p.Length() > 0 {
				location = strings.TrimSpace(p.Text())
			}
		}
		if location == "" {
			if loc := container.Find("[class*='location'],[class*='venue'],[class*='city']"); loc.Length() > 0 {
				location = strings.TrimSpace(loc.First().Text())
			}
		}
		if location == "" {
			location = "N/A"
		}

		eventType := "Offline"
		if strings.Contains(strings.ToLower(location), "online") ||
			strings.Contains(strings.ToLower(title), "online") {
			eventType = "Online"
		}
		if !utils.IsOfflineEvent(eventType, location, title) {
			return
		}

		// ── Build description snippet from any visible text ─────────
		description := ""
		if d := container.Find("[class*='description'],[class*='desc'],[class*='summary']"); d.Length() > 0 {
			description = strings.TrimSpace(d.First().Text())
		}

		// Embed the scraped image URL in Description as a marker so the
		// detail scraper can persist it into event_details.image_url
		// without an additional HTTP round-trip.
		// Format: "[img:https://...]" at the start of description.
		if imageURL != "" {
			description = fmt.Sprintf("[img:%s] %s", imageURL, description)
		}

		events = append(events, models.Event{
			EventName:   title,
			Date:        date,
			Location:    location,
			Website:     website,
			Description: strings.TrimSpace(description),
			EventType:   "Offline",
			Platform:    "echai",
		})
	})

	fmt.Printf("eChai: Found %d upcoming offline events\n", len(events))
	return events, nil
}

// resolveURL converts a relative href to an absolute URL.
func resolveURL(base, href string) string {
	href = strings.TrimSpace(href)
	if strings.HasPrefix(href, "http") {
		return href
	}
	if strings.HasPrefix(href, "//") {
		return "https:" + href
	}
	if strings.HasPrefix(href, "/") {
		return base + href
	}
	return base + "/" + href
}
