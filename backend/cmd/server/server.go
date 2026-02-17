// backend/cmd/server/main.go
// Run: go run cmd/server/main.go
// API: GET /api/events?q=&location=&source=&from=&to=&page=1&limit=8

package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// ─── Models ──────────────────────────────────────────────────────────────────

type Event struct {
	ID          int       `json:"id"`
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
	CreatedAt   time.Time `json:"created_at"`
}

type EventsResponse struct {
	Events     []Event  `json:"events"`
	Total      int      `json:"total"`
	Page       int      `json:"page"`
	Limit      int      `json:"limit"`
	TotalPages int      `json:"total_pages"`
	Locations  []string `json:"locations"`
	Sources    []string `json:"sources"`
}

// ─── Server ───────────────────────────────────────────────────────────────────

type Server struct {
	db *sql.DB
}

func main() {
	// Load from env or .env file
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		// Fallback: build from individual env vars (matching your existing config)
		connStr = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			getEnv("DB_HOST", "localhost"),
			getEnv("DB_PORT", "5432"),
			getEnv("DB_USER", "postgres"),
			getEnv("DB_PASSWORD", "Dheekshith@15"),
			getEnv("DB_NAME", "event_scraper"),
		)
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to open DB: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	log.Println("✅ Connected to PostgreSQL")

	s := &Server{db: db}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/events", s.withCORS(s.handleEvents))
	mux.HandleFunc("/api/events/filters", s.withCORS(s.handleFilters))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte(`{"status":"ok"}`))
	})

	port := getEnv("PORT", "8080")
	log.Printf("🚀 API server running at http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

// ─── Handlers ────────────────────────────────────────────────────────────────

// GET /api/events
// Query params: q, location, source, from (YYYY-MM-DD), to (YYYY-MM-DD), page, limit
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()

	search   := strings.TrimSpace(q.Get("q"))
	location := strings.TrimSpace(q.Get("location"))
	source   := strings.TrimSpace(q.Get("source"))
	dateFrom := strings.TrimSpace(q.Get("from"))
	dateTo   := strings.TrimSpace(q.Get("to"))

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 8
	}
	offset := (page - 1) * limit

	// Build WHERE clause
	conditions := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(event_name ILIKE $%d OR description ILIKE $%d OR location ILIKE $%d)",
			idx, idx, idx,
		))
		args = append(args, "%"+search+"%")
		idx++
	}
	if location != "" {
		conditions = append(conditions, fmt.Sprintf("location = $%d", idx))
		args = append(args, location)
		idx++
	}
	if source != "" {
		conditions = append(conditions, fmt.Sprintf("platform = $%d", idx))
		args = append(args, source)
		idx++
	}
	// Date filtering - use the date column (string comparison will work for YYYY-MM-DD format)
	if dateFrom != "" {
		conditions = append(conditions, fmt.Sprintf("date >= $%d", idx))
		args = append(args, dateFrom)
		idx++
	}
	if dateTo != "" {
		conditions = append(conditions, fmt.Sprintf("date <= $%d", idx))
		args = append(args, dateTo)
		idx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	// Count
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM events %s", where)
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		jsonError(w, "Failed to count events: "+err.Error(), 500)
		return
	}

	// Fetch events
	eventsQuery := fmt.Sprintf(`
		SELECT
			id,
			COALESCE(event_name, '') AS event_name,
			COALESCE(location, '') AS location,
			COALESCE(date_time, '') AS date_time,
			COALESCE(date, '') AS date,
			COALESCE(time, '') AS time,
			COALESCE(website, '') AS website,
			COALESCE(description, '') AS description,
			COALESCE(address, '') AS address,
			COALESCE(event_type, '') AS event_type,
			COALESCE(platform, '') AS platform,
			created_at
		FROM events
		%s
		ORDER BY 
			CASE 
				WHEN date ~ '^\d{4}-\d{2}-\d{2}$' THEN date::date
				ELSE CURRENT_DATE + INTERVAL '100 years'
			END ASC,
			created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, idx, idx+1)

	rows, err := s.db.Query(eventsQuery, append(args, limit, offset)...)
	if err != nil {
		jsonError(w, "Failed to fetch events: "+err.Error(), 500)
		return
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		var e Event
		err := rows.Scan(
			&e.ID, &e.EventName, &e.Location,
			&e.DateTime, &e.Date, &e.Time,
			&e.Website, &e.Description, &e.Address,
			&e.EventType, &e.Platform, &e.CreatedAt,
		)
		if err != nil {
			log.Printf("Row scan error: %v", err)
			continue
		}
		events = append(events, e)
	}

	// Fetch filter options
	locations := s.distinctValues("location")
	sources := s.distinctValues("platform")

	totalPages := (total + limit - 1) / limit
	if totalPages < 1 {
		totalPages = 1
	}

	resp := EventsResponse{
		Events:     events,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
		Locations:  locations,
		Sources:    sources,
	}

	jsonOK(w, resp)
}

// GET /api/events/filters — returns available filter options
func (s *Server) handleFilters(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]interface{}{
		"locations": s.distinctValues("location"),
		"sources":   s.distinctValues("platform"),
	})
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func (s *Server) distinctValues(column string) []string {
	rows, err := s.db.Query(fmt.Sprintf(
		"SELECT DISTINCT %s FROM events WHERE %s IS NOT NULL AND %s != '' ORDER BY %s",
		column, column, column, column,
	))
	if err != nil {
		return []string{}
	}
	defer rows.Close()
	var vals []string
	for rows.Next() {
		var v string
		rows.Scan(&v)
		if v != "" {
			vals = append(vals, v)
		}
	}
	return vals
}

func (s *Server) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func jsonOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
