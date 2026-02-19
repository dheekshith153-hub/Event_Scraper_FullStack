package models

import "time"

type SavedEvent struct {
	ID        int64     `json:"id"`
	UserID    string    `json:"user_id"`    // FK to users table
	EventID   int64     `json:"event_id"`   // FK to events table
	Notes     string    `json:"notes"`      // User's personal notes
	SavedAt   time.Time `json:"saved_at"`
	CreatedAt time.Time `json:"created_at"`
}

type SavedEventWithDetails struct {
	SavedEvent
	Event       Event       `json:"event"`
	EventDetail EventDetail `json:"event_detail"`
}