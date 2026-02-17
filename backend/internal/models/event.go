package models

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
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
	Address     string    `json:"address"`     // Specific venue address
	EventType   string    `json:"event_type"` // Online/Offline
	Platform    string    `json:"platform"`   // allevents, biec, hasgeek, etc.
	Hash        string    `json:"hash"`       // For duplicate detection
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// GenerateHash creates a unique hash for duplicate detection
func (e *Event) GenerateHash() string {
	// Normalize strings for better duplicate detection
	name := strings.ToLower(strings.TrimSpace(e.EventName))
	location := strings.ToLower(strings.TrimSpace(e.Location))
	platform := strings.ToLower(strings.TrimSpace(e.Platform))
	date := strings.ToLower(strings.TrimSpace(e.DateTime))
	if date == "" {
		date = strings.ToLower(strings.TrimSpace(e.Date))
	}

	// Create unique identifier from key fields (include platform for cross-platform dedup)
	key := fmt.Sprintf("%s|%s|%s|%s", name, location, date, platform)

	// Generate SHA256 hash
	hash := sha256.Sum256([]byte(key))
	e.Hash = hex.EncodeToString(hash[:])
	return e.Hash
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

	// Default location to N/A if missing
	if e.Location == "" {
		e.Location = "N/A"
	}

	// Detect event type from location if not set
	if e.EventType == "" {
		if strings.Contains(strings.ToLower(e.Location), "online") || strings.Contains(strings.ToLower(e.Address), "online") {
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
