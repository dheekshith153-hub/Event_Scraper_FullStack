package models

import (
	"crypto/sha256"
	"encoding/hex"
	"time"
)

type EventDetail struct {
	ID               int64     `json:"id"`
	EventID          int64     `json:"event_id"`          // FK to events table
	FullDescription  string    `json:"full_description"`  // Rich HTML/text description
	Organizer        string    `json:"organizer"`         // Event organizer name
	OrganizerContact string    `json:"organizer_contact"` // Contact info
	ImageURL         string    `json:"image_url"`         // Main event image
	Tags             string    `json:"tags"`              // Comma-separated tags
	Price            string    `json:"price"`             // Free, Paid, $50, etc.
	RegistrationURL  string    `json:"registration_url"`  // Direct registration link
	Duration         string    `json:"duration"`          // "2 hours", "3 days", etc.
	AgendaHTML       string    `json:"agenda_html"`       // Event schedule/agenda
	SpeakersJSON     string    `json:"speakers_json"`     // JSON array of speakers
	Prerequisites    string    `json:"prerequisites"`     // Required skills/items
	MaxAttendees     int       `json:"max_attendees"`     // Capacity
	AttendeesCount   int       `json:"attendees_count"`   // Current registered
	LastScraped      time.Time `json:"last_scraped"`      // When we last updated this
	ScrapedBody      string    `json:"scraped_body"`      // Raw HTML for debugging
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// GenerateHash for deduplication
func (ed *EventDetail) GenerateHash() string {
	key := ed.FullDescription + ed.Organizer + ed.ImageURL
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}