package scrapers

import (
	"bytes"
	"context"
	"event-scraper/internal/models"
	"event-scraper/pkg/utils"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
)

const (
	townscriptBaseURL   = "https://www.townscript.com"
	townscriptIndiaTech = "https://www.townscript.com/in/india/tech?page=%d"

	townscriptMaxPages       = 25
	townscriptMaxEmptyPages  = 2
	townscriptMinHTMLSize    = 1200
	townscriptPoliteDelayMS  = 700
)

type TownscriptScraper struct {
	*BaseScraper
}

func NewTownscriptScraper(timeout time.Duration, retries int) *TownscriptScraper {
	return &TownscriptScraper{
		BaseScraper: NewBaseScraper(timeout, retries),
	}
}

func (s *TownscriptScraper) Name() string { return "townscript" }

func (s *TownscriptScraper) Scrape(ctx context.Context) ([]models.Event, error) {
	var all []models.Event
	seen := map[string]bool{}
	emptyStreak := 0

	for page := 1; page <= townscriptMaxPages; page++ {
		select {
		case <-ctx.Done():
			return all, ctx.Err()
		default:
		}

		url := fmt.Sprintf(townscriptIndiaTech, page)
		evs, err := s.scrapePage(ctx, url, seen)
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

func (s *TownscriptScraper) scrapePage(ctx context.Context, url string, seen map[string]bool) ([]models.Event, error) {
	// Fast path: normal HTTP
	html, err := s.fetchHTML(ctx, url)
	if err != nil || len(strings.TrimSpace(html)) < townscriptMinHTMLSize {
		// fallback: chromedp (Townscript is Angular; sometimes SSR is enough, sometimes not)
		html, err = s.fetchHTMLWithChrome(ctx, url)
		if err != nil {
			return nil, err
		}
	}

	return s.parseHTML(html, seen)
}

func (s *TownscriptScraper) fetchHTML(ctx context.Context, url string) (string, error) {
	resp, err := s.FetchWithRetry(ctx, url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (s *TownscriptScraper) fetchHTMLWithChrome(ctx context.Context, url string) (string, error) {
	allocCtx, cancel := NewChromeContext(ctx)
	defer cancel()

	var htmlContent string
	err := chromedp.Run(
		allocCtx,
		chromedp.Navigate(url),
		chromedp.Sleep(3*time.Second),
		chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight/2)`, nil),
		chromedp.Sleep(800*time.Millisecond),
		chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight)`, nil),
		chromedp.Sleep(800*time.Millisecond),
		chromedp.OuterHTML("html", &htmlContent),
	)
	if err != nil {
		return "", fmt.Errorf("chrome fetch failed: %w", err)
	}
	return htmlContent, nil
}

func (s *TownscriptScraper) parseHTML(html string, seen map[string]bool) ([]models.Event, error) {
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader([]byte(html)))
	if err != nil {
		return nil, err
	}

	var events []models.Event

	// ✅ YOUR REAL STRUCTURE:
	// div.ls-card a[href^="/e/"] contains ts-listings-event-card
	// title:    .event-name (spans)
	// date:     .secondary-details .date span
	// location: .secondary-details .location span
	doc.Find("div.ls-card a[href^='/e/']").Each(func(_ int, a *goquery.Selection) {
		href, ok := a.Attr("href")
		if !ok {
			return
		}
		website := normalizeTownscriptURL(href)
		if website == "" || seen[website] {
			return
		}

		// Title
		title := cleanSpaceTownscript(a.Find(".event-name").First().Text())
		if title == "" {
			// fallback (sometimes text is inside spans)
			title = cleanSpaceTownscript(a.Find("div.event-name-box").First().Text())
		}
		if len(title) < 3 {
			return
		}

		// Date
		date := cleanSpaceTownscript(a.Find(".secondary-details .date").First().Text())
		// e.g. "Daily" -> treat as upcoming (Townscript uses Daily for recurring)
		// If date is empty, keep and let DB store it.

		// Location
		location := cleanSpaceTownscript(a.Find(".secondary-details .location").First().Text())
		if location == "" {
			location = "N/A"
		}

		// ✅ Filter: remove learning/coaching/institute/course listings
		// Your example: "Best Data Analytics Training..." must be removed.
		if isLearningListingTownscript(title) {
			return
		}

		// upcoming filter (allow "Daily")
		if date != "" && strings.ToLower(date) != "daily" && !utils.IsUpcoming(date) {
			return
		}

		// offline filter (location-based)
		if !utils.IsOfflineEvent("", location, title) {
			return
		}

		seen[website] = true
		events = append(events, models.Event{
			EventName: title,
			Location:  location,
			Address:   "",
			Date:      date,
			Website:   website,
			EventType: "Offline",
			Platform:  "townscript",
		})
	})

	// ✅ Extra fallback if ls-card selector changes:
	// still target the Townscript component but same inner selectors.
	if len(events) == 0 {
		doc.Find("ts-listings-event-card").Each(func(_ int, card *goquery.Selection) {
			// The anchor is usually above it, but sometimes inside parents
			a := card.ParentsFiltered("a[href]").First()
			if a.Length() == 0 {
				a = card.Find("a[href]").First()
			}
			href, _ := a.Attr("href")
			website := normalizeTownscriptURL(href)
			if website == "" || seen[website] {
				return
			}

			title := cleanSpaceTownscript(card.Find(".event-name").First().Text())
			if title == "" {
				title = cleanSpaceTownscript(card.Text())
				title = firstLineTownscript(title)
			}
			if len(title) < 3 {
				return
			}

			location := cleanSpaceTownscript(card.Find(".secondary-details .location").First().Text())
			if location == "" {
				location = "N/A"
			}

			date := cleanSpaceTownscript(card.Find(".secondary-details .date").First().Text())

			if isLearningListingTownscript(title) {
				return
			}
			if date != "" && strings.ToLower(date) != "daily" && !utils.IsUpcoming(date) {
				return
			}
			if !utils.IsOfflineEvent("", location, title) {
				return
			}

			seen[website] = true
			events = append(events, models.Event{
				EventName: title,
				Location:  location,
				Address:   "",
				Date:      date,
				Website:   website,
				EventType: "Offline",
				Platform:  "townscript",
			})
		})
	}

	return events, nil
}

func normalizeTownscriptURL(href string) string {
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
		return townscriptBaseURL + href
	}
	if strings.Contains(href, "townscript.com") && !strings.HasPrefix(href, "http") {
		return "https://" + href
	}
	return ""
}

func cleanSpaceTownscript(s string) string {
	s = strings.ReplaceAll(s, "\u00a0", " ")
	return strings.Join(strings.Fields(s), " ")
}

func firstLineTownscript(s string) string {
	s = cleanSpaceTownscript(s)
	if s == "" {
		return ""
	}
	// if it's still huge, cut early
	if len(s) > 120 {
		return strings.TrimSpace(s[:120])
	}
	return s
}

// ✅ filter learning/institute/training/etc (for Townscript)
func isLearningListingTownscript(title string) bool {
	t := strings.ToLower(cleanSpaceTownscript(title))

	learningKeywords := []string{
		"training", "course", "classes", "coaching", "academy", "institute", "institution",
		"school", "e-school", "learning", "certification", "certificate", "bootcamp",
		"batch", "internship", "syllabus", "curriculum", "admission",
		"tuition", "workshop series", "placement", "job guarantee",
		"ielts", "toefl", "spoken english",
		"data analytics training", "python training", "java training", "full stack course",
	}

	for _, kw := range learningKeywords {
		if strings.Contains(t, kw) {
			return true
		}
	}

	return false
}
