package models

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"
)

type Event struct {
	ID          int64     `json:"id"`
	EventName   string    `json:"event_name"`
	Location    string    `json:"location"`
	DateTime    string    `json:"date_time"`
	Date        string    `json:"date"`
	Time        string    `json:"time"`
	Website     string    `json:"website"`
	Description string    `json:"description"`
	Address     string    `json:"address"`
	EventType   string    `json:"event_type"`
	Platform    string    `json:"platform"`
	Hash        string    `json:"hash"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// GenerateHash creates a unique hash for duplicate detection.
// Primary key: website URL (stripped of query params and trailing slash).
// Fallback (no URL): event name + platform — intentionally excludes date
// so recurring meetups don't generate a new hash each occurrence.
func (e *Event) GenerateHash() {
	var key string

	website := strings.TrimSpace(strings.ToLower(e.Website))

	// Strip query params for a stable URL key
	if idx := strings.Index(website, "?"); idx != -1 {
		website = website[:idx]
	}
	website = strings.TrimRight(website, "/")

	if website != "" {
		key = website
	} else {
		name := strings.ToLower(strings.TrimSpace(e.EventName))
		platform := strings.ToLower(strings.TrimSpace(e.Platform))
		key = name + "|" + platform
	}

	h := sha256.Sum256([]byte(key))
	e.Hash = hex.EncodeToString(h[:])
}

// Normalize cleans and standardizes event data
func (e *Event) Normalize() {
	e.EventName = strings.TrimSpace(e.EventName)
	e.Location = strings.TrimSpace(e.Location)
	e.Address = strings.TrimSpace(e.Address)
	e.DateTime = strings.TrimSpace(e.DateTime)
	e.Date = strings.TrimSpace(e.Date)
	e.Time = strings.TrimSpace(e.Time)
	e.Website = strings.TrimSpace(e.Website)
	e.Description = strings.TrimSpace(e.Description)
	e.EventType = strings.TrimSpace(e.EventType)
	e.Platform = strings.TrimSpace(e.Platform)

	if e.Location == "" {
		e.Location = "N/A"
	}

	if e.EventType == "" {
		if strings.Contains(strings.ToLower(e.Location), "online") ||
			strings.Contains(strings.ToLower(e.Address), "online") {
			e.EventType = "Online"
		} else {
			e.EventType = "Offline"
		}
	}
}

// IsValid checks if the event has required fields
func (e *Event) IsValid() bool {
	return e.EventName != "" && e.Platform != ""
}