package utils

import (
	"fmt"
	"strings"
	"time"
)

// Common date formats found across event platforms
var dateFormats = []string{
	// ISO 8601
	"2006-01-02T15:04:05Z07:00",
	"2006-01-02T15:04:05Z",
	"2006-01-02T15:04:05",
	"2006-01-02T15:04",
	"2006-01-02",

	// US formats
	"January 2, 2006",
	"Jan 2, 2006",
	"January 02, 2006",
	"Jan 02, 2006",

	// With day of week
	"Monday, January 2, 2006",
	"Mon, January 2, 2006",
	"Monday, Jan 2, 2006",
	"Mon, Jan 2, 2006",

	// Compact
	"02 Jan 2006",
	"2 Jan 2006",
	"02 January 2006",
	"2 January 2006",

	// Slash-separated
	"01/02/2006",
	"02/01/2006",
	"2006/01/02",

	// Dash-separated (non-ISO)
	"02-01-2006",
	"01-02-2006",

	// With time
	"January 2, 2006 3:04 PM",
	"Jan 2, 2006 3:04 PM",
	"02 Jan 2006 15:04",
	"2006-01-02 15:04:05",
	"2006-01-02 15:04",

	// Date range prefix (take the start date)
	"Jan 2 - Jan 2, 2006",
}

// ParseDate attempts to parse a date string using multiple known formats.
// Returns the parsed time and true if successful, or zero time and false if not.
func ParseDate(dateStr string) (time.Time, bool) {
	dateStr = strings.TrimSpace(dateStr)
	if dateStr == "" {
		return time.Time{}, false
	}

	// Clean up common prefixes/suffixes
	dateStr = cleanDateString(dateStr)

	// Try each format
	for _, format := range dateFormats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t, true
		}
	}

	// Try parsing with IST timezone
	loc, _ := time.LoadLocation("Asia/Kolkata")
	if loc != nil {
		for _, format := range dateFormats {
			if t, err := time.ParseInLocation(format, dateStr, loc); err == nil {
				return t, true
			}
		}
	}

	return time.Time{}, false
}

// IsUpcoming returns true if the date string represents today or a future date.
// If the date cannot be parsed, returns true (benefit of the doubt — keep the event).
func IsUpcoming(dateStr string) bool {
	t, ok := ParseDate(dateStr)
	if !ok {
		// Cannot parse date — keep the event
		return true
	}

	// Compare dates only (ignore time component)
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	eventDate := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())

	return !eventDate.Before(today)
}

// IsOfflineEvent returns true if the event is an offline/onsite event.
// Returns false for online/virtual events.
func IsOfflineEvent(eventType, location, title string) bool {
	combined := strings.ToLower(eventType + " " + location + " " + title)

	onlineIndicators := []string{"online", "virtual", "webinar", "web-based", "remote event"}
	for _, indicator := range onlineIndicators {
		if strings.Contains(combined, indicator) {
			return false
		}
	}

	return true
}

// NormalizeToGMT parses any date string and returns it normalised to UTC/GMT
// as "2006-01-02" (date-only ISO) ready for DB storage.
// If parsing fails the original string is returned unchanged so no data is lost.
func NormalizeToGMT(dateStr string) string {
	t, ok := ParseDate(dateStr)
	if !ok {
		return dateStr
	}
	return t.UTC().Format("2006-01-02")
}

// NormalizeToGMTFull parses any date string and returns a full UTC timestamp
// "2006-01-02T15:04:05Z" for cases where time precision matters.
// If parsing fails the original string is returned unchanged.
func NormalizeToGMTFull(dateStr string) string {
	t, ok := ParseDate(dateStr)
	if !ok {
		return dateStr
	}
	return t.UTC().Format("2006-01-02T15:04:05Z")
}

// cleanDateString removes common noise from date strings.
func cleanDateString(s string) string {
	s = strings.TrimSpace(s)

	// Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
	replacer := strings.NewReplacer(
		"1st", "1", "2nd", "2", "3rd", "3",
		"4th", "4", "5th", "5", "6th", "6",
		"7th", "7", "8th", "8", "9th", "9",
		"0th", "0",
		"  ", " ",
	)
	s = replacer.Replace(s)

	// If it's a date range like "Feb 17 - Feb 20, 2026", take just the start
	if idx := strings.Index(s, " - "); idx > 0 {
		parts := strings.SplitN(s, " - ", 2)
		startPart := strings.TrimSpace(parts[0])

		if len(parts) > 1 {
			endPart := strings.TrimSpace(parts[1])
			for i := len(endPart) - 4; i >= 0; i-- {
				yearStr := endPart[i : i+4]
				if yearStr >= "2020" && yearStr <= "2035" {
					if _, err := time.Parse("2006", yearStr); err == nil {
						hasYear := false
						for y := 2020; y <= 2035; y++ {
							if strings.Contains(startPart, fmt.Sprintf("%d", y)) {
								hasYear = true
								break
							}
						}
						if !hasYear {
							startPart = startPart + ", " + yearStr
						}
						break
					}
				}
			}
		}
		s = startPart
	}

	return strings.TrimSpace(s)
}
