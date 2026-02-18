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

	s := &Server{db: db}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/events", s.withCORS(s.handleEvents))
	mux.HandleFunc("/api/events/filters", s.withCORS(s.handleFilters))
	mux.HandleFunc("/api/auth/signup", s.withCORS(s.handleSignup))
	mux.HandleFunc("/api/auth/signin", s.withCORS(s.handleSignin))
	mux.HandleFunc("/api/auth/me", s.withCORS(s.handleMe))

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
