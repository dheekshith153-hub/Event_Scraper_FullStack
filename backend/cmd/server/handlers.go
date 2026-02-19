package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

// ============ EVENT DETAIL ENDPOINT ============

type EventDetailResponse struct {
	Event            Event        `json:"event"`
	EventDetail      *EventDetail `json:"event_detail"`
	IsSaved          bool         `json:"is_saved"`
	RecommendedCount int          `json:"recommended_count"`
}

type EventDetail struct {
	ID               int64  `json:"id"`
	EventID          int64  `json:"event_id"`
	FullDescription  string `json:"full_description"`
	Organizer        string `json:"organizer"`
	OrganizerContact string `json:"organizer_contact"`
	ImageURL         string `json:"image_url"`
	Tags             string `json:"tags"`
	Price            string `json:"price"`
	RegistrationURL  string `json:"registration_url"`
	Duration         string `json:"duration"`
	AgendaHTML       string `json:"agenda_html"`
	SpeakersJSON     string `json:"speakers_json"`
	Prerequisites    string `json:"prerequisites"`
	MaxAttendees     int    `json:"max_attendees"`
	AttendeesCount   int    `json:"attendees_count"`
}

// GET /api/events/:id
func (s *Server) handleEventDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract event ID from URL path
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		jsonError(w, "Invalid URL", 400)
		return
	}

	eventID, err := strconv.ParseInt(pathParts[2], 10, 64)
	if err != nil {
		jsonError(w, "Invalid event ID", 400)
		return
	}

	// Get event
	var event Event
	err = s.db.QueryRow(`
		SELECT id, COALESCE(event_name, ''), COALESCE(location, ''),
		       COALESCE(date_time, ''), COALESCE(date, ''), COALESCE(time, ''),
		       COALESCE(website, ''), COALESCE(description, ''), COALESCE(address, ''),
		       COALESCE(event_type, ''), COALESCE(platform, ''), created_at
		FROM events WHERE id = $1
	`, eventID).Scan(
		&event.ID, &event.EventName, &event.Location, &event.DateTime,
		&event.Date, &event.Time, &event.Website, &event.Description,
		&event.Address, &event.EventType, &event.Platform, &event.CreatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		jsonError(w, "Event not found", 404)
		return
	}
	if err != nil {
		jsonError(w, "Database error: "+err.Error(), 500)
		return
	}

	// Get event details (may not exist yet)
	var detail EventDetail
	err = s.db.QueryRow(`
		SELECT id, event_id, COALESCE(full_description, ''), COALESCE(organizer, ''),
		       COALESCE(organizer_contact, ''), COALESCE(image_url, ''), COALESCE(tags, ''),
		       COALESCE(price, ''), COALESCE(registration_url, ''), COALESCE(duration, ''),
		       COALESCE(agenda_html, ''), COALESCE(speakers_json, ''), COALESCE(prerequisites, ''),
		       COALESCE(max_attendees, 0), COALESCE(attendees_count, 0)
		FROM event_details WHERE event_id = $1
	`, eventID).Scan(
		&detail.ID, &detail.EventID, &detail.FullDescription, &detail.Organizer,
		&detail.OrganizerContact, &detail.ImageURL, &detail.Tags, &detail.Price,
		&detail.RegistrationURL, &detail.Duration, &detail.AgendaHTML, &detail.SpeakersJSON,
		&detail.Prerequisites, &detail.MaxAttendees, &detail.AttendeesCount,
	)

	var detailPtr *EventDetail
	if err == nil {
		detailPtr = &detail
	} else if !errors.Is(err, sql.ErrNoRows) {
		// Real error, not just missing details
		jsonError(w, "Database error fetching details: "+err.Error(), 500)
		return
	}

	// Check if user has saved this event (if authenticated)
	isSaved := false
	userID := getUserID(r)
	if userID != "" {
		var count int
		err = s.db.QueryRow(`
			SELECT COUNT(*) FROM saved_events 
			WHERE user_id = $1 AND event_id = $2
		`, userID, eventID).Scan(&count)
		if err == nil && count > 0 {
			isSaved = true
		}
	}

	// Count recommended events (same location/category)
	var recommendedCount int
	s.db.QueryRow(`
		SELECT COUNT(*) FROM events 
		WHERE id != $1 
		  AND platform = $2 
		  AND location ILIKE $3
		LIMIT 10
	`, eventID, event.Platform, "%"+event.Location+"%").Scan(&recommendedCount)

	response := EventDetailResponse{
		Event:            event,
		EventDetail:      detailPtr,
		IsSaved:          isSaved,
		RecommendedCount: recommendedCount,
	}

	jsonOK(w, response)
}

// ============ RECOMMENDED EVENTS ENDPOINT ============

// GET /api/events/:id/recommended
func (s *Server) handleRecommendedEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		jsonError(w, "Invalid URL", 400)
		return
	}

	eventID, err := strconv.ParseInt(pathParts[2], 10, 64)
	if err != nil {
		jsonError(w, "Invalid event ID", 400)
		return
	}

	// Get the source event for comparison
	var sourceEvent Event
	err = s.db.QueryRow(`
		SELECT platform, location FROM events WHERE id = $1
	`, eventID).Scan(&sourceEvent.Platform, &sourceEvent.Location)

	if errors.Is(err, sql.ErrNoRows) {
		jsonError(w, "Event not found", 404)
		return
	}
	if err != nil {
		jsonError(w, "Database error: "+err.Error(), 500)
		return
	}

	// Find similar events (same platform or location, exclude current event)
	rows, err := s.db.Query(`
		SELECT id, COALESCE(event_name, ''), COALESCE(location, ''),
		       COALESCE(date_time, ''), COALESCE(date, ''), COALESCE(time, ''),
		       COALESCE(website, ''), COALESCE(description, ''), COALESCE(address, ''),
		       COALESCE(event_type, ''), COALESCE(platform, ''), created_at
		FROM events
		WHERE id != $1
		  AND (
		    platform = $2 OR location ILIKE $3
		  )
		ORDER BY 
			CASE WHEN platform = $2 THEN 0 ELSE 1 END,
			created_at DESC
		LIMIT 10
	`, eventID, sourceEvent.Platform, "%"+sourceEvent.Location+"%")

	if err != nil {
		jsonError(w, "Database error: "+err.Error(), 500)
		return
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var e Event
		err := rows.Scan(
			&e.ID, &e.EventName, &e.Location, &e.DateTime,
			&e.Date, &e.Time, &e.Website, &e.Description,
			&e.Address, &e.EventType, &e.Platform, &e.CreatedAt,
		)
		if err != nil {
			continue
		}
		events = append(events, e)
	}

	jsonOK(w, map[string]interface{}{
		"events": events,
		"total":  len(events),
	})
}

// ============ SAVE EVENT ENDPOINT ============

type SaveEventRequest struct {
	Notes string `json:"notes"`
}

// POST /api/events/:id/save
func (s *Server) handleSaveEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		jsonError(w, "Unauthorized", 401)
		return
	}

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		jsonError(w, "Invalid URL", 400)
		return
	}

	eventID, err := strconv.ParseInt(pathParts[2], 10, 64)
	if err != nil {
		jsonError(w, "Invalid event ID", 400)
		return
	}

	// Check if event exists
	var exists bool
	err = s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM events WHERE id = $1)", eventID).Scan(&exists)
	if err != nil || !exists {
		jsonError(w, "Event not found", 404)
		return
	}

	// Parse request body (optional notes)
	var req SaveEventRequest
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&req)
	}

	// Insert or update saved event
	_, err = s.db.Exec(`
		INSERT INTO saved_events (user_id, event_id, notes, saved_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id, event_id) 
		DO UPDATE SET notes = EXCLUDED.notes, saved_at = NOW()
	`, userID, eventID, req.Notes)

	if err != nil {
		jsonError(w, "Failed to save event: "+err.Error(), 500)
		return
	}

	jsonOK(w, map[string]interface{}{
		"message": "Event saved successfully",
		"saved":   true,
	})
}

// DELETE /api/events/:id/save
func (s *Server) handleUnsaveEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		jsonError(w, "Unauthorized", 401)
		return
	}

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		jsonError(w, "Invalid URL", 400)
		return
	}

	eventID, err := strconv.ParseInt(pathParts[2], 10, 64)
	if err != nil {
		jsonError(w, "Invalid event ID", 400)
		return
	}

	result, err := s.db.Exec(`
		DELETE FROM saved_events 
		WHERE user_id = $1 AND event_id = $2
	`, userID, eventID)

	if err != nil {
		jsonError(w, "Failed to unsave event: "+err.Error(), 500)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		jsonError(w, "Event was not saved", 404)
		return
	}

	jsonOK(w, map[string]interface{}{
		"message": "Event unsaved successfully",
		"saved":   false,
	})
}

// ============ GET USER'S SAVED EVENTS ============

// GET /api/saved-events
func (s *Server) handleGetSavedEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := getUserID(r)
	if userID == "" {
		jsonError(w, "Unauthorized", 401)
		return
	}

	rows, err := s.db.Query(`
		SELECT 
			se.id, se.event_id, se.notes, se.saved_at,
			e.id, COALESCE(e.event_name, ''), COALESCE(e.location, ''),
			COALESCE(e.date_time, ''), COALESCE(e.date, ''), COALESCE(e.time, ''),
			COALESCE(e.website, ''), COALESCE(e.description, ''), COALESCE(e.address, ''),
			COALESCE(e.event_type, ''), COALESCE(e.platform, ''), e.created_at
		FROM saved_events se
		JOIN events e ON se.event_id = e.id
		WHERE se.user_id = $1
		ORDER BY se.saved_at DESC
	`, userID)

	if err != nil {
		jsonError(w, "Database error: "+err.Error(), 500)
		return
	}
	defer rows.Close()

	type SavedEventFull struct {
		ID      int64  `json:"id"`
		EventID int64  `json:"event_id"`
		Notes   string `json:"notes"`
		SavedAt string `json:"saved_at"`
		Event   Event  `json:"event"`
	}

	var savedEvents []SavedEventFull
	for rows.Next() {
		var se SavedEventFull
		var e Event
		err := rows.Scan(
			&se.ID, &se.EventID, &se.Notes, &se.SavedAt,
			&e.ID, &e.EventName, &e.Location, &e.DateTime,
			&e.Date, &e.Time, &e.Website, &e.Description,
			&e.Address, &e.EventType, &e.Platform, &e.CreatedAt,
		)
		if err != nil {
			continue
		}
		se.Event = e
		savedEvents = append(savedEvents, se)
	}

	jsonOK(w, map[string]interface{}{
		"saved_events": savedEvents,
		"total":        len(savedEvents),
	})
}

// POST /api/scrape/details - Manually trigger detail scraping
func (s *Server) handleManualDetailScrape(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Optional: require admin auth here
	// For now, allow anyone to trigger (remove in production)

	go func() {
		fmt.Println("\n🚀 Manual detail scraping triggered...")
		
		// Create a detail scraper
		detailScraper := NewDetailScraperForManual(s.db)
		
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()
		
		details, err := detailScraper.Scrape(ctx)
		if err != nil {
			fmt.Printf("❌ Manual scrape failed: %v\n", err)
			return
		}
		
		fmt.Printf("✅ Manual scrape completed: %d details extracted\n", len(details))
	}()

	jsonOK(w, map[string]interface{}{
		"message": "Detail scraping started in background",
		"status":  "running",
	})
}

// Helper to create detail scraper for manual trigger
func NewDetailScraperForManual(db *sql.DB) *scrapers.DetailScraper {
	timeout := 30 * time.Second
	retries := 3
	return scrapers.NewDetailScraper(db, timeout, retries)
}