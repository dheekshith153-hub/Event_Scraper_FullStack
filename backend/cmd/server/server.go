// backend/cmd/server/server.go
// Run: go run cmd/server/server.go
// API:
//   GET  /api/events?q=&location=&source=&from=&to=&page=1&limit=8
//   GET  /api/events/filters
//   POST /api/auth/signup   { "fullName":"", "email":"", "password":"" }
//   POST /api/auth/signin   { "email":"", "password":"" }
//   GET  /api/auth/me        (Authorization: Bearer <token>)
//   GET  /health

package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"event-scraper/internal/scrapers"

)

// ─── JWT Secret ──────────────────────────────────────────────────────────────

var jwtSecret = []byte(getEnv("JWT_SECRET", "event-scraper-secret-key-change-me"))

// ─── City Mapping ─────────────────────────────────────────────────────────────
// Maps keywords found in raw location strings → clean city display names.
// Order matters: more specific entries should come first.

var cityKeywords = []struct {
	keyword string
	display string
}{
	{"new delhi", "New Delhi"},
	{"bengaluru", "Bengaluru"},
	{"bangalore", "Bengaluru"},
	{"mumbai", "Mumbai"},
	{"hyderabad", "Hyderabad"},
	{"kolkata", "Kolkata"},
	{"calcutta", "Kolkata"},
	{"chennai", "Chennai"},
	{"madras", "Chennai"},
	{"pune", "Pune"},
	{"ahmedabad", "Ahmedabad"},
	{"jaipur", "Jaipur"},
	{"delhi", "New Delhi"},
	{"noida", "Noida"},
	{"gurugram", "Gurugram"},
	{"gurgaon", "Gurugram"},
	{"online", "Online"},
	{"virtual", "Online"},
	{"remote", "Online"},
}

// extractCity maps a raw location string to a clean city name.
// Returns "" if no known city is detected.
func extractCity(location string) string {
	lower := strings.ToLower(location)
	for _, ck := range cityKeywords {
		if strings.Contains(lower, ck.keyword) {
			return ck.display
		}
	}
	return ""
}

// cityToILIKE returns a SQL ILIKE pattern for the given city display name.
// e.g. "Bengaluru" → searches for "bengaluru" OR "bangalore" in the location column.
func cityToCondition(city string, argIdx int) (string, []interface{}) {
	var patterns []string
	var args []interface{}

	for _, ck := range cityKeywords {
		if ck.display == city {
			patterns = append(patterns, fmt.Sprintf("location ILIKE $%d", argIdx))
			args = append(args, "%"+ck.keyword+"%")
			argIdx++
		}
	}

	if len(patterns) == 0 {
		// Fallback: exact match
		return fmt.Sprintf("location ILIKE $%d", argIdx), []interface{}{"%" + city + "%"}
	}

	return "(" + strings.Join(patterns, " OR ") + ")", args
}

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

type User struct {
	ID           string    `json:"id"`
	FullName     string    `json:"full_name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type SignupRequest struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SigninRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// ─── Server ───────────────────────────────────────────────────────────────────

type Server struct {
	db *sql.DB
}

func main() {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
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

	if _, err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`); err != nil {
		log.Printf("⚠️  Could not ensure pgcrypto extension: %v", err)
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
		  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		  full_name     VARCHAR(120) NOT NULL,
		  email         VARCHAR(180) UNIQUE NOT NULL,
		  password_hash TEXT NOT NULL,
		  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
		  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
		);
	`); err != nil {
		log.Printf("⚠️  Could not ensure users table: %v", err)
	} else {
		log.Println("✅ Users table ready (UUID)")
	}

	// Ensure event_details table
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS event_details (
		  id               SERIAL PRIMARY KEY,
		  event_id         INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		  full_description TEXT,
		  organizer        VARCHAR(300),
		  organizer_contact VARCHAR(500),
		  image_url        VARCHAR(1000),
		  tags             TEXT,
		  price            VARCHAR(200),
		  registration_url VARCHAR(1000),
		  duration         VARCHAR(100),
		  agenda_html      TEXT,
		  speakers_json    TEXT,
		  prerequisites    TEXT,
		  max_attendees    INTEGER DEFAULT 0,
		  attendees_count  INTEGER DEFAULT 0,
		  last_scraped     TIMESTAMP,
		  scraped_body     TEXT,
		  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
		  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
		  UNIQUE(event_id)
		);
	`); err != nil {
		log.Printf("⚠️  Could not ensure event_details table: %v", err)
	} else {
		log.Println("✅ Event details table ready")
	}

	// Ensure saved_events table
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS saved_events (
		  id         SERIAL PRIMARY KEY,
		  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		  notes      TEXT,
		  saved_at   TIMESTAMP NOT NULL DEFAULT NOW(),
		  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		  UNIQUE(user_id, event_id)
		);
	`); err != nil {
		log.Printf("⚠️  Could not ensure saved_events table: %v", err)
	} else {
		log.Println("✅ Saved events table ready")
	}

	s := &Server{db: db}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/events", s.withCORS(s.handleEvents))
	mux.HandleFunc("/api/events/filters", s.withCORS(s.handleFilters))
	mux.HandleFunc("/api/auth/signup", s.withCORS(s.handleSignup))
	mux.HandleFunc("/api/auth/signin", s.withCORS(s.handleSignin))
	mux.HandleFunc("/api/auth/me", s.withCORS(s.handleMe))
	mux.HandleFunc("/api/events/", s.withCORS(s.handleEventRoutes))
	mux.HandleFunc("/api/saved-events", s.withCORS(s.requireAuth(s.handleGetSavedEvents)))
	mux.HandleFunc("/api/scrape/details", s.withCORS(s.handleManualDetailScrape))


	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		w.Write([]byte(`{"status":"ok"}`))
	})

	port := getEnv("PORT", "8080")
	log.Printf("🚀 API server running at http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

// ─── Auth Handlers ───────────────────────────────────────────────────────────

func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", 400)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)

	if req.FullName == "" || req.Email == "" || req.Password == "" {
		jsonError(w, "Full name, email and password are required", 400)
		return
	}
	if len(req.Password) < 6 {
		jsonError(w, "Password must be at least 6 characters", 400)
		return
	}

	var exists bool
	if err := s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)", req.Email).Scan(&exists); err != nil {
		jsonError(w, "Server error", 500)
		return
	}
	if exists {
		jsonError(w, "An account with this email already exists", 409)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "Server error", 500)
		return
	}

	var user User
	err = s.db.QueryRow(
		`INSERT INTO users (full_name, email, password_hash)
		 VALUES ($1, $2, $3)
		 RETURNING id::text, full_name, email, created_at`,
		req.FullName, req.Email, string(hash),
	).Scan(&user.ID, &user.FullName, &user.Email, &user.CreatedAt)
	if err != nil {
		log.Printf("Signup DB error: %v", err)
		jsonError(w, "Failed to create account", 500)
		return
	}

	token, err := generateJWT(user.ID, user.Email)
	if err != nil {
		jsonError(w, "Failed to generate token", 500)
		return
	}

	jsonOK(w, AuthResponse{Token: token, User: user})
}

func (s *Server) handleSignin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SigninRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", 400)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		jsonError(w, "Email and password are required", 400)
		return
	}

	var user User
	err := s.db.QueryRow(
		`SELECT id::text, full_name, email, password_hash, created_at
		 FROM users WHERE email=$1`,
		req.Email,
	).Scan(&user.ID, &user.FullName, &user.Email, &user.PasswordHash, &user.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		jsonError(w, "Invalid email or password", 401)
		return
	}
	if err != nil {
		log.Printf("Signin DB error: %v", err)
		jsonError(w, "Server error", 500)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		jsonError(w, "Invalid email or password", 401)
		return
	}

	token, err := generateJWT(user.ID, user.Email)
	if err != nil {
		jsonError(w, "Failed to generate token", 500)
		return
	}

	jsonOK(w, AuthResponse{Token: token, User: user})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		jsonError(w, "Unauthorized", 401)
		return
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := parseJWT(tokenStr)
	if err != nil {
		jsonError(w, "Invalid or expired token", 401)
		return
	}

	userID, ok := claims["user_id"].(string)
	if !ok || userID == "" {
		jsonError(w, "Invalid token", 401)
		return
	}

	var user User
	err = s.db.QueryRow(
		`SELECT id::text, full_name, email, created_at
		 FROM users WHERE id=$1`,
		userID,
	).Scan(&user.ID, &user.FullName, &user.Email, &user.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		jsonError(w, "User not found", 404)
		return
	}
	if err != nil {
		log.Printf("Me DB error: %v", err)
		jsonError(w, "Server error", 500)
		return
	}

	jsonOK(w, map[string]interface{}{"user": user})
}

// ─── JWT Helpers ─────────────────────────────────────────────────────────────

func generateJWT(userID string, email string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"email":   email,
		"exp":     time.Now().Add(72 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func parseJWT(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

// GET /api/events
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()

	search := strings.TrimSpace(q.Get("q"))
	location := strings.TrimSpace(q.Get("location")) // now a city name e.g. "Bengaluru"
	source := strings.TrimSpace(q.Get("source"))
	dateFrom := strings.TrimSpace(q.Get("from"))
	dateTo := strings.TrimSpace(q.Get("to"))

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 8
	}
	offset := (page - 1) * limit

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

	// ── City filter: use ILIKE to match all raw location strings for this city ──
	if location != "" {
		cond, cityArgs := cityToCondition(location, idx)
		conditions = append(conditions, cond)
		args = append(args, cityArgs...)
		idx += len(cityArgs)
	}

	if source != "" {
		conditions = append(conditions, fmt.Sprintf("platform = $%d", idx))
		args = append(args, source)
		idx++
	}
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

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM events %s", where)
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		jsonError(w, "Failed to count events: "+err.Error(), 500)
		return
	}

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

	// Return clean city names for the filter dropdown
	locations := s.distinctCities()
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

// GET /api/events/filters
func (s *Server) handleFilters(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]interface{}{
		"locations": s.distinctCities(),
		"sources":   s.distinctValues("platform"),
	})
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// distinctCities fetches all raw location values from the DB and maps them
// to clean city names, returning a deduplicated sorted list.
func (s *Server) distinctCities() []string {
	rows, err := s.db.Query(
		"SELECT DISTINCT location FROM events WHERE location IS NOT NULL AND location != '' ORDER BY location",
	)
	if err != nil {
		return []string{}
	}
	defer rows.Close()

	seen := map[string]bool{}
	var cities []string

	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil || raw == "" {
			continue
		}
		city := extractCity(raw)
		if city != "" && !seen[city] {
			seen[city] = true
			cities = append(cities, city)
		}
	}

	// Sort alphabetically
	for i := 0; i < len(cities); i++ {
		for j := i + 1; j < len(cities); j++ {
			if cities[i] > cities[j] {
				cities[i], cities[j] = cities[j], cities[i]
			}
		}
	}

	return cities
}

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
		_ = rows.Scan(&v)
		if v != "" {
			vals = append(vals, v)
		}
	}
	return vals
}

func (s *Server) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func jsonOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (s *Server) handleEventRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/events/")
	parts := strings.Split(path, "/")

	if len(parts) < 1 {
		jsonError(w, "Invalid URL", 400)
		return
	}

	// Extract event ID
	eventIDStr := parts[0]
	_, err := strconv.ParseInt(eventIDStr, 10, 64)
	if err != nil {
		jsonError(w, "Invalid event ID", 400)
		return
	}

	// Route based on path
	if len(parts) == 1 {
		// /api/events/:id
		s.optionalAuth(s.handleEventDetail)(w, r)
	} else if len(parts) == 2 {
		switch parts[1] {
		case "recommended":
			// /api/events/:id/recommended
			s.handleRecommendedEvents(w, r)
		case "save":
			// /api/events/:id/save
			if r.Method == http.MethodPost {
				s.requireAuth(s.handleSaveEvent)(w, r)
			} else if r.Method == http.MethodDelete {
				s.requireAuth(s.handleUnsaveEvent)(w, r)
			} else {
				jsonError(w, "Method not allowed", 405)
			}
		default:
			jsonError(w, "Not found", 404)
		}
	} else {
		jsonError(w, "Not found", 404)
	}
}

// ─── Context Key for Auth ────────────────────────────────────────────────────

type contextKey string

const userIDKey contextKey = "userID"

// getUserID extracts user ID from request context
func getUserID(r *http.Request) string {
	userID, _ := r.Context().Value(userIDKey).(string)
	return userID
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

func (s *Server) optionalAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := parseJWT(tokenStr)
			if err == nil {
				if userID, ok := claims["user_id"].(string); ok && userID != "" {
					ctx := context.WithValue(r.Context(), userIDKey, userID)
					r = r.WithContext(ctx)
				}
			}
		}
		next(w, r)
	}
}

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			jsonError(w, "Unauthorized - No token provided", 401)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := parseJWT(tokenStr)
		if err != nil {
			jsonError(w, "Invalid or expired token", 401)
			return
		}

		userID, ok := claims["user_id"].(string)
		if !ok || userID == "" {
			jsonError(w, "Invalid token claims", 401)
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next(w, r.WithContext(ctx))
	}
}

// ─── Event Detail ────────────────────────────────────────────────────────────

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

	path := strings.TrimPrefix(r.URL.Path, "/api/events/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 || parts[0] == "" {
		jsonError(w, "Invalid event ID", 400)
		return
	}

	eventID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		jsonError(w, "Invalid event ID", 400)
		return
	}

	// Get event
	var e Event
	err = s.db.QueryRow(`
		SELECT id, COALESCE(event_name, ''), COALESCE(location, ''),
		       COALESCE(date_time, ''), COALESCE(date, ''), COALESCE(time, ''),
		       COALESCE(website, ''), COALESCE(description, ''), COALESCE(address, ''),
		       COALESCE(event_type, ''), COALESCE(platform, ''), created_at
		FROM events WHERE id = $1
	`, eventID).Scan(
		&e.ID, &e.EventName, &e.Location, &e.DateTime,
		&e.Date, &e.Time, &e.Website, &e.Description,
		&e.Address, &e.EventType, &e.Platform, &e.CreatedAt,
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

	// Count recommended events
	var recommendedCount int
	s.db.QueryRow(`
		SELECT COUNT(*) FROM events 
		WHERE id != $1 AND platform = $2 AND location ILIKE $3
		LIMIT 10
	`, eventID, e.Platform, "%"+e.Location+"%").Scan(&recommendedCount)

	jsonOK(w, map[string]interface{}{
		"event":             e,
		"event_detail":      detailPtr,
		"is_saved":          isSaved,
		"recommended_count": recommendedCount,
	})
}

// ─── Recommended Events ──────────────────────────────────────────────────────

// GET /api/events/:id/recommended
func (s *Server) handleRecommendedEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/events/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 || parts[0] == "" {
		jsonOK(w, map[string]interface{}{"events": []Event{}, "total": 0})
		return
	}

	eventID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		jsonOK(w, map[string]interface{}{"events": []Event{}, "total": 0})
		return
	}

	// Get the source event for comparison
	var platform, location string
	err = s.db.QueryRow(`
		SELECT COALESCE(platform, ''), COALESCE(location, '') FROM events WHERE id = $1
	`, eventID).Scan(&platform, &location)
	if err != nil {
		jsonOK(w, map[string]interface{}{"events": []Event{}, "total": 0})
		return
	}

	rows, err := s.db.Query(`
		SELECT id, COALESCE(event_name, ''), COALESCE(location, ''),
		       COALESCE(date_time, ''), COALESCE(date, ''), COALESCE(time, ''),
		       COALESCE(website, ''), COALESCE(description, ''), COALESCE(address, ''),
		       COALESCE(event_type, ''), COALESCE(platform, ''), created_at
		FROM events
		WHERE id != $1
		  AND (platform = $2 OR location ILIKE $3)
		ORDER BY 
			CASE WHEN platform = $2 THEN 0 ELSE 1 END,
			created_at DESC
		LIMIT 10
	`, eventID, platform, "%"+location+"%")
	if err != nil {
		jsonOK(w, map[string]interface{}{"events": []Event{}, "total": 0})
		return
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var ev Event
		if err := rows.Scan(
			&ev.ID, &ev.EventName, &ev.Location, &ev.DateTime,
			&ev.Date, &ev.Time, &ev.Website, &ev.Description,
			&ev.Address, &ev.EventType, &ev.Platform, &ev.CreatedAt,
		); err == nil {
			events = append(events, ev)
		}
	}

	jsonOK(w, map[string]interface{}{
		"events": events,
		"total":  len(events),
	})
}

// ─── Save / Unsave Events ────────────────────────────────────────────────────

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

	path := strings.TrimPrefix(r.URL.Path, "/api/events/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 {
		jsonError(w, "Invalid URL", 400)
		return
	}

	eventID, err := strconv.ParseInt(parts[0], 10, 64)
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

	// Parse optional notes
	var body struct {
		Notes string `json:"notes"`
	}
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&body)
	}

	// Insert or update saved event
	_, err = s.db.Exec(`
		INSERT INTO saved_events (user_id, event_id, notes, saved_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id, event_id) 
		DO UPDATE SET notes = EXCLUDED.notes, saved_at = NOW()
	`, userID, eventID, body.Notes)

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

	path := strings.TrimPrefix(r.URL.Path, "/api/events/")
	parts := strings.Split(path, "/")
	if len(parts) < 1 {
		jsonError(w, "Invalid URL", 400)
		return
	}

	eventID, err := strconv.ParseInt(parts[0], 10, 64)
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

// ─── Get Saved Events ────────────────────────────────────────────────────────

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
			se.id, se.event_id, COALESCE(se.notes, ''), se.saved_at,
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
		var ev Event
		err := rows.Scan(
			&se.ID, &se.EventID, &se.Notes, &se.SavedAt,
			&ev.ID, &ev.EventName, &ev.Location, &ev.DateTime,
			&ev.Date, &ev.Time, &ev.Website, &ev.Description,
			&ev.Address, &ev.EventType, &ev.Platform, &ev.CreatedAt,
		)
		if err != nil {
			continue
		}
		se.Event = ev
		savedEvents = append(savedEvents, se)
	}

	jsonOK(w, map[string]interface{}{
		"saved_events": savedEvents,
		"total":        len(savedEvents),
	})
}

func (s *Server) handleManualDetailScrape(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fmt.Println("\n🚀 Manual detail scraping triggered...")

	detailScraper := scrapers.NewDetailScraper(s.db, 30*time.Second, 3)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	inserted := 0
	updated := 0
	failed := 0

	// ✅ New callback-based signature — saves immediately per event
	err := detailScraper.Scrape(ctx, func(detail scrapers.ScrapedDetail) error {
		isNew, err := s.insertOrUpdateEventDetail(detail)
		if err != nil {
			fmt.Printf("❌ Failed to save detail for event %d: %v\n", detail.EventID, err)
			failed++
			return err
		}
		if isNew {
			inserted++
		} else {
			updated++
		}
		return nil
	})

	if err != nil {
		fmt.Printf("❌ Scraping failed: %v\n", err)
		jsonError(w, fmt.Sprintf("Scraping failed: %v", err), 500)
		return
	}

	fmt.Printf("💾 Database save results: inserted=%d, updated=%d, failed=%d\n", inserted, updated, failed)

	jsonOK(w, map[string]interface{}{
		"message":       "Scraping completed",
		"inserted":      inserted,
		"updated":       updated,
		"failed":        failed,
		"status":        "completed",
	})
}

// Insert or update event detail
func (s *Server) insertOrUpdateEventDetail(detail scrapers.ScrapedDetail) (bool, error) {
	// Check if exists
	var exists bool
	err := s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM event_details WHERE event_id = $1)", detail.EventID).Scan(&exists)
	if err != nil {
		return false, err
	}

	query := `
		INSERT INTO event_details (
			event_id, full_description, organizer, organizer_contact,
			image_url, tags, price, registration_url, duration,
			agenda_html, speakers_json, prerequisites,
			max_attendees, attendees_count, last_scraped, scraped_body
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15)
		ON CONFLICT (event_id) 
		DO UPDATE SET
			full_description = EXCLUDED.full_description,
			organizer = EXCLUDED.organizer,
			organizer_contact = EXCLUDED.organizer_contact,
			image_url = EXCLUDED.image_url,
			tags = EXCLUDED.tags,
			price = EXCLUDED.price,
			registration_url = EXCLUDED.registration_url,
			duration = EXCLUDED.duration,
			agenda_html = EXCLUDED.agenda_html,
			speakers_json = EXCLUDED.speakers_json,
			prerequisites = EXCLUDED.prerequisites,
			max_attendees = EXCLUDED.max_attendees,
			attendees_count = EXCLUDED.attendees_count,
			last_scraped = NOW(),
			scraped_body = EXCLUDED.scraped_body,
			updated_at = NOW()
	`

	_, err = s.db.Exec(query,
		detail.EventID, detail.FullDescription, detail.Organizer, detail.OrganizerContact,
		detail.ImageURL, detail.Tags, detail.Price, detail.RegistrationURL, detail.Duration,
		detail.AgendaHTML, detail.SpeakersJSON, detail.Prerequisites,
		detail.MaxAttendees, detail.AttendeesCount, detail.ScrapedBody,
	)

	return !exists, err
}


