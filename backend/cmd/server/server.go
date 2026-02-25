// backend/cmd/server/server.go
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

// ─── JWT Secret ───────────────────────────────────────────────────────────────

var jwtSecret = []byte(getEnv("JWT_SECRET", "event-scraper-secret-key-change-me"))

var cityKeywords = []struct {
	keyword string
	display string
}{
	// ── Bengaluru ─────────────────────────────────────────────────────────
	{"bengaluru", "Bengaluru"},
	{"bangalore", "Bengaluru"},
	{"koramangala", "Bengaluru"},
	{"indiranagar", "Bengaluru"},
	{"whitefield", "Bengaluru"},
	{"hsr layout", "Bengaluru"},
	{"hsr", "Bengaluru"},
	{"marathahalli", "Bengaluru"},
	{"hebbal", "Bengaluru"},
	{"electronic city", "Bengaluru"},
	{"jp nagar", "Bengaluru"},
	{"jayanagar", "Bengaluru"},
	{"malleswaram", "Bengaluru"},
	{"yelahanka", "Bengaluru"},
	{"devanahalli", "Bengaluru"},
	{"bellandur", "Bengaluru"},
	{"sarjapur", "Bengaluru"},
	{"domlur", "Bengaluru"},
	{"btm layout", "Bengaluru"},
	{"btm", "Bengaluru"},
	{"mg road", "Bengaluru"},
	{"ulsoor", "Bengaluru"},
	{"kaikondrahalli", "Bengaluru"},
	{"jakkur", "Bengaluru"},
	{"rajajinagar", "Bengaluru"},
	{"yeshwanthpur", "Bengaluru"},
	{"peenya", "Bengaluru"},
	{"biec", "Bengaluru"},
	{"bangalore international exhibition", "Bengaluru"},
	{"ktpo", "Bengaluru"},
	{"nimhans convention", "Bengaluru"},
	{"draper startup", "Bengaluru"},
	{"91springboard", "Bengaluru"},
	{"wework galaxy", "Bengaluru"},

	// ── Mumbai ────────────────────────────────────────────────────────────
	{"mumbai", "Mumbai"},
	{"bombay", "Mumbai"},
	{"andheri", "Mumbai"},
	{"bandra", "Mumbai"},
	{"powai", "Mumbai"},
	{"lower parel", "Mumbai"},
	{"goregaon", "Mumbai"},
	{"malad", "Mumbai"},
	{"borivali", "Mumbai"},
	{"thane", "Mumbai"},
	{"navi mumbai", "Mumbai"},
	{"worli", "Mumbai"},
	{"dadar", "Mumbai"},
	{"juhu", "Mumbai"},
	{"kurla", "Mumbai"},
	{"vikhroli", "Mumbai"},
	{"mulund", "Mumbai"},
	{"bkc", "Mumbai"},
	{"bandra kurla", "Mumbai"},
	{"kandivali", "Mumbai"},
	{"chembur", "Mumbai"},
	{"ghatkopar", "Mumbai"},
	{"nesco", "Mumbai"},
	{"bombay exhibition", "Mumbai"},
	{"nehru centre", "Mumbai"},
	{"nsci dome", "Mumbai"},
	{"world trade centre", "Mumbai"},
	{"jio world", "Mumbai"},

	// ── Hyderabad ─────────────────────────────────────────────────────────
	{"hyderabad", "Hyderabad"},
	{"gachibowli", "Hyderabad"},
	{"hitech city", "Hyderabad"},
	{"hitec city", "Hyderabad"},
	{"madhapur", "Hyderabad"},
	{"banjara hills", "Hyderabad"},
	{"jubilee hills", "Hyderabad"},
	{"kondapur", "Hyderabad"},
	{"miyapur", "Hyderabad"},
	{"secunderabad", "Hyderabad"},
	{"kukatpally", "Hyderabad"},
	{"begumpet", "Hyderabad"},
	{"manikonda", "Hyderabad"},
	{"nanakramguda", "Hyderabad"},
	{"durgam cheruvu", "Hyderabad"},
	{"financial district", "Hyderabad"},
	{"hitex", "Hyderabad"},
	{"hitex exhibition", "Hyderabad"},
	{"hyderabad international convention", "Hyderabad"},
	{"hicc", "Hyderabad"},
	{"novotel hyderabad", "Hyderabad"},
	{"cokarma", "Hyderabad"},
	{"t-hub", "Hyderabad"},
	{"t hub", "Hyderabad"},

	// ── Pune ──────────────────────────────────────────────────────────────
	{"pune", "Pune"},
	{"koregaon park", "Pune"},
	{"viman nagar", "Pune"},
	{"hinjewadi", "Pune"},
	{"wakad", "Pune"},
	{"kothrud", "Pune"},
	{"baner", "Pune"},
	{"aundh", "Pune"},
	{"hadapsar", "Pune"},
	{"kharadi", "Pune"},
	{"magarpatta", "Pune"},
	{"shivajinagar", "Pune"},
	{"ideas to impacts", "Pune"},

	// ── Delhi / NCR ───────────────────────────────────────────────────────
	{"new delhi", "New Delhi"},
	{"delhi", "New Delhi"},
	{"connaught place", "New Delhi"},
	{"aerocity", "New Delhi"},
	{"nehru place", "New Delhi"},
	{"karol bagh", "New Delhi"},
	{"vasant kunj", "New Delhi"},
	{"dwarka", "New Delhi"},
	{"rohini", "New Delhi"},
	{"saket", "New Delhi"},
	{"hauz khas", "New Delhi"},
	{"india expo mart", "New Delhi"},
	{"pragati maidan", "New Delhi"},
	{"bharat mandapam", "New Delhi"},
	{"yashobhoomi", "New Delhi"},

	// ── Noida ─────────────────────────────────────────────────────────────
	{"noida", "Noida"},
	{"greater noida", "Noida"},
	{"india expo centre", "Noida"},

	// ── Gurugram ──────────────────────────────────────────────────────────
	{"gurugram", "Gurugram"},
	{"gurgaon", "Gurugram"},
	{"cyber hub", "Gurugram"},
	{"cyberhub", "Gurugram"},
	{"cyber city", "Gurugram"},
	{"dlf cyber", "Gurugram"},
	{"sohna road", "Gurugram"},
	{"golf course road", "Gurugram"},

	// ── Chennai ───────────────────────────────────────────────────────────
	{"chennai", "Chennai"},
	{"madras", "Chennai"},
	{"t nagar", "Chennai"},
	{"anna nagar", "Chennai"},
	{"velachery", "Chennai"},
	{"adyar", "Chennai"},
	{"nungambakkam", "Chennai"},
	{"sholinganallur", "Chennai"},
	{"perungudi", "Chennai"},
	{"tidel park", "Chennai"},

	// ── Kolkata ───────────────────────────────────────────────────────────
	{"kolkata", "Kolkata"},
	{"calcutta", "Kolkata"},
	{"salt lake", "Kolkata"},
	{"new town kolkata", "Kolkata"},
	{"rajarhat", "Kolkata"},
	{"park street", "Kolkata"},
	{"sector v", "Kolkata"},

	// ── Ahmedabad ─────────────────────────────────────────────────────────
	{"ahmedabad", "Ahmedabad"},
	{"sg highway", "Ahmedabad"},
	{"cg road", "Ahmedabad"},
	{"navrangpura", "Ahmedabad"},
	{"prahlad nagar", "Ahmedabad"},
	{"bodakdev", "Ahmedabad"},

	// ── Jaipur ────────────────────────────────────────────────────────────
	{"jaipur", "Jaipur"},
	{"malviya nagar jaipur", "Jaipur"},
	{"vaishali nagar", "Jaipur"},
	{"sitapura", "Jaipur"},
	{"jecc", "Jaipur"},

	// ── Online ────────────────────────────────────────────────────────────
	{"online", "Online"},
	{"virtual", "Online"},
	{"remote", "Online"},
	{"zoom", "Online"},
	{"webinar", "Online"},
}

func extractCity(location string) string {
	lower := strings.ToLower(location)
	for _, ck := range cityKeywords {
		if strings.Contains(lower, ck.keyword) {
			return ck.display
		}
	}
	return ""
}

func cityToCondition(alias string, city string, argIdx int) (string, []interface{}) {
	var patterns []string
	var args []interface{}

	for _, ck := range cityKeywords {
		if ck.display == city {
			patterns = append(patterns, fmt.Sprintf("%s.location ILIKE $%d", alias, argIdx))
			args = append(args, "%"+ck.keyword+"%")
			argIdx++
		}
	}

	if len(patterns) == 0 {
		return fmt.Sprintf("%s.location ILIKE $%d", alias, argIdx), []interface{}{"%" + city + "%"}
	}

	return "(" + strings.Join(patterns, " OR ") + ")", args
}

// ─── Models ───────────────────────────────────────────────────────────────────

// ✅ city_normalized added — canonical city name for display on cards/detail
type Event struct {
	ID             int       `json:"id"`
	EventName      string    `json:"event_name"`
	Location       string    `json:"location"`
	CityNormalized string    `json:"city_normalized"` // ✅ NEW
	DateTime       string    `json:"date_time"`
	Date           string    `json:"date"`
	Time           string    `json:"time"`
	Website        string    `json:"website"`
	Description    string    `json:"description"`
	Address        string    `json:"address"`
	EventType      string    `json:"event_type"`
	Platform       string    `json:"platform"`
	ImageURL       string    `json:"image_url"`
	CreatedAt      time.Time `json:"created_at"`
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

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS scraper_runs (
		  id               SERIAL PRIMARY KEY,
		  scraper_name     VARCHAR(100) NOT NULL,
		  success          BOOLEAN NOT NULL DEFAULT false,
		  events_found     INTEGER DEFAULT 0,
		  events_filtered  INTEGER DEFAULT 0,
		  error_message    TEXT,
		  duration_seconds REAL DEFAULT 0,
		  run_at           TIMESTAMP NOT NULL DEFAULT NOW()
		);
	`); err != nil {
		log.Printf("⚠️  Could not ensure scraper_runs table: %v", err)
	} else {
		log.Println("✅ Scraper runs table ready")
	}

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
	mux.HandleFunc("/api/admin/scraper-health", s.withCORS(s.handleScraperHealth))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		w.Write([]byte(`{"status":"ok"}`))
	})

	port := getEnv("PORT", "8080")
	log.Printf("🚀 API server running at http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

// ─── Auth Handlers ────────────────────────────────────────────────────────────

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
		`SELECT id::text, full_name, email, password_hash, created_at FROM users WHERE email=$1`,
		req.Email,
	).Scan(&user.ID, &user.FullName, &user.Email, &user.PasswordHash, &user.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		jsonError(w, "Invalid email or password", 401)
		return
	}
	if err != nil {
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
		`SELECT id::text, full_name, email, created_at FROM users WHERE id=$1`, userID,
	).Scan(&user.ID, &user.FullName, &user.Email, &user.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		jsonError(w, "User not found", 404)
		return
	}
	if err != nil {
		jsonError(w, "Server error", 500)
		return
	}

	jsonOK(w, map[string]interface{}{"user": user})
}

// ─── JWT Helpers ──────────────────────────────────────────────────────────────

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

// ─── Event Handlers ───────────────────────────────────────────────────────────

// scanEvent scans a full event row including city_normalized and image_url.
// Column order must match: id, event_name, location, city_normalized, date_time,
// date, time, website, description, address, event_type, platform, image_url, created_at
func scanEvent(row interface {
	Scan(...interface{}) error
}, e *Event) error {
	return row.Scan(
		&e.ID, &e.EventName, &e.Location, &e.CityNormalized,
		&e.DateTime, &e.Date, &e.Time,
		&e.Website, &e.Description, &e.Address,
		&e.EventType, &e.Platform, &e.ImageURL,
		&e.CreatedAt,
	)
}

// eventSelectCols returns the standard SELECT column list for an event joined
// with event_details. Caller must supply the events alias (e.g. "e") and
// event_details alias (e.g. "ed").
func eventSelectCols(eAlias, edAlias string) string {
	return fmt.Sprintf(`
		%s.id,
		COALESCE(%s.event_name, '')      AS event_name,
		COALESCE(%s.location, '')        AS location,
		COALESCE(%s.city_normalized, '') AS city_normalized,
		COALESCE(%s.date_time, '')       AS date_time,
		COALESCE(%s.date, '')            AS date,
		COALESCE(%s.time, '')            AS time,
		COALESCE(%s.website, '')         AS website,
		COALESCE(%s.description, '')     AS description,
		COALESCE(%s.address, '')         AS address,
		COALESCE(%s.event_type, '')      AS event_type,
		COALESCE(%s.platform, '')        AS platform,
		COALESCE(%s.image_url, '')       AS image_url,
		%s.created_at`,
		eAlias,
		eAlias, eAlias, eAlias, eAlias, eAlias, eAlias, eAlias, eAlias, eAlias, eAlias, eAlias,
		edAlias,
		eAlias,
	)
}

// GET /api/events
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	search := strings.TrimSpace(q.Get("q"))
	location := strings.TrimSpace(q.Get("location"))
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
			"(inner_e.event_name ILIKE $%d OR inner_e.description ILIKE $%d OR inner_e.location ILIKE $%d)",
			idx, idx, idx,
		))
		args = append(args, "%"+search+"%")
		idx++
	}

	// ✅ Filter on city_normalized for clean city matching
	if location != "" {
		conditions = append(conditions, fmt.Sprintf("inner_e.city_normalized = $%d", idx))
		args = append(args, location)
		idx++
	}

	if source != "" {
		conditions = append(conditions, fmt.Sprintf("inner_e.platform = $%d", idx))
		args = append(args, source)
		idx++
	}
	if dateFrom != "" {
		conditions = append(conditions, fmt.Sprintf("inner_e.date >= $%d", idx))
		args = append(args, dateFrom)
		idx++
	}
	if dateTo != "" {
		conditions = append(conditions, fmt.Sprintf("inner_e.date <= $%d", idx))
		args = append(args, dateTo)
		idx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM events inner_e %s", where)
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		jsonError(w, "Failed to count events: "+err.Error(), 500)
		return
	}

	cols := eventSelectCols("e", "ed")
	eventsQuery := fmt.Sprintf(`
		SELECT %s
		FROM (
			SELECT inner_e.*,
				ROW_NUMBER() OVER (
					PARTITION BY inner_e.platform
					ORDER BY
						CASE WHEN inner_e.date ~ '^\d{4}-\d{2}-\d{2}$'
							THEN inner_e.date::date
							ELSE CURRENT_DATE + INTERVAL '100 years'
						END ASC,
						inner_e.created_at DESC
				) AS platform_rank
			FROM events inner_e
			%s
		) e
		LEFT JOIN event_details ed ON e.id = ed.event_id
		ORDER BY
			e.platform_rank ASC,
			CASE WHEN e.date ~ '^\d{4}-\d{2}-\d{2}$'
				THEN e.date::date
				ELSE CURRENT_DATE + INTERVAL '100 years'
			END ASC,
			e.platform ASC
		LIMIT $%d OFFSET $%d
	`, cols, where, idx, idx+1)

	rows, err := s.db.Query(eventsQuery, append(args, limit, offset)...)
	if err != nil {
		jsonError(w, "Failed to fetch events: "+err.Error(), 500)
		return
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(
			&e.ID, &e.EventName, &e.Location, &e.CityNormalized,
			&e.DateTime, &e.Date, &e.Time,
			&e.Website, &e.Description, &e.Address,
			&e.EventType, &e.Platform, &e.ImageURL,
			&e.CreatedAt,
		); err != nil {
			log.Printf("Row scan error: %v", err)
			continue
		}
		events = append(events, e)
	}

	// ✅ Locations from city_normalized column — clean city names only
	locations := s.distinctCities()
	sources := s.distinctValues("platform")

	totalPages := (total + limit - 1) / limit
	if totalPages < 1 {
		totalPages = 1
	}

	jsonOK(w, EventsResponse{
		Events:     events,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
		Locations:  locations,
		Sources:    sources,
	})
}

// GET /api/events/filters
func (s *Server) handleFilters(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]interface{}{
		"locations": s.distinctCities(),
		"sources":   s.distinctValues("platform"),
	})
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

	var e Event
	err = s.db.QueryRow(fmt.Sprintf(`
		SELECT %s
		FROM events e
		LEFT JOIN event_details ed ON e.id = ed.event_id
		WHERE e.id = $1
	`, eventSelectCols("e", "ed")), eventID).Scan(
		&e.ID, &e.EventName, &e.Location, &e.CityNormalized,
		&e.DateTime, &e.Date, &e.Time,
		&e.Website, &e.Description, &e.Address,
		&e.EventType, &e.Platform, &e.ImageURL,
		&e.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		jsonError(w, "Event not found", 404)
		return
	}
	if err != nil {
		jsonError(w, "Database error: "+err.Error(), 500)
		return
	}

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

	isSaved := false
	userID := getUserID(r)
	if userID != "" {
		var count int
		s.db.QueryRow(`
			SELECT COUNT(*) FROM saved_events WHERE user_id = $1 AND event_id = $2
		`, userID, eventID).Scan(&count)
		isSaved = count > 0
	}

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

	var platform, cityNorm string
	err = s.db.QueryRow(`
		SELECT COALESCE(platform, ''), COALESCE(city_normalized, '') FROM events WHERE id = $1
	`, eventID).Scan(&platform, &cityNorm)
	if err != nil {
		jsonOK(w, map[string]interface{}{"events": []Event{}, "total": 0})
		return
	}

	rows, err := s.db.Query(fmt.Sprintf(`
		SELECT %s
		FROM events e
		LEFT JOIN event_details ed ON e.id = ed.event_id
		WHERE e.id != $1
		  AND (e.platform = $2 OR e.city_normalized = $3)
		ORDER BY
			CASE WHEN e.platform = $2 THEN 0 ELSE 1 END,
			e.created_at DESC
		LIMIT 10
	`, eventSelectCols("e", "ed")), eventID, platform, cityNorm)
	if err != nil {
		jsonOK(w, map[string]interface{}{"events": []Event{}, "total": 0})
		return
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var ev Event
		if err := rows.Scan(
			&ev.ID, &ev.EventName, &ev.Location, &ev.CityNormalized,
			&ev.DateTime, &ev.Date, &ev.Time,
			&ev.Website, &ev.Description, &ev.Address,
			&ev.EventType, &ev.Platform, &ev.ImageURL,
			&ev.CreatedAt,
		); err == nil {
			events = append(events, ev)
		}
	}

	jsonOK(w, map[string]interface{}{
		"events": events,
		"total":  len(events),
	})
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

	var exists bool
	s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM events WHERE id = $1)", eventID).Scan(&exists)
	if !exists {
		jsonError(w, "Event not found", 404)
		return
	}

	var body struct {
		Notes string `json:"notes"`
	}
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&body)
	}

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

	jsonOK(w, map[string]interface{}{"message": "Event saved successfully", "saved": true})
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
	eventID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		jsonError(w, "Invalid event ID", 400)
		return
	}

	result, err := s.db.Exec(`
		DELETE FROM saved_events WHERE user_id = $1 AND event_id = $2
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

	jsonOK(w, map[string]interface{}{"message": "Event unsaved successfully", "saved": false})
}

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

	rows, err := s.db.Query(fmt.Sprintf(`
		SELECT
			se.id, se.event_id, COALESCE(se.notes, ''), se.saved_at,
			%s
		FROM saved_events se
		JOIN events e ON se.event_id = e.id
		LEFT JOIN event_details ed ON e.id = ed.event_id
		WHERE se.user_id = $1
		ORDER BY se.saved_at DESC
	`, eventSelectCols("e", "ed")), userID)
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
			&ev.ID, &ev.EventName, &ev.Location, &ev.CityNormalized,
			&ev.DateTime, &ev.Date, &ev.Time,
			&ev.Website, &ev.Description, &ev.Address,
			&ev.EventType, &ev.Platform, &ev.ImageURL,
			&ev.CreatedAt,
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

// POST /api/scrape/details
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
		jsonError(w, fmt.Sprintf("Scraping failed: %v", err), 500)
		return
	}

	jsonOK(w, map[string]interface{}{
		"message":  "Scraping completed",
		"inserted": inserted,
		"updated":  updated,
		"failed":   failed,
		"status":   "completed",
	})
}

func (s *Server) insertOrUpdateEventDetail(detail scrapers.ScrapedDetail) (bool, error) {
	var exists bool
	s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM event_details WHERE event_id = $1)", detail.EventID).Scan(&exists)

	_, err := s.db.Exec(`
		INSERT INTO event_details (
			event_id, full_description, organizer, organizer_contact,
			image_url, tags, price, registration_url, duration,
			agenda_html, speakers_json, prerequisites,
			max_attendees, attendees_count, last_scraped, scraped_body
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15)
		ON CONFLICT (event_id) DO UPDATE SET
			full_description  = EXCLUDED.full_description,
			organizer         = EXCLUDED.organizer,
			organizer_contact = EXCLUDED.organizer_contact,
			image_url         = EXCLUDED.image_url,
			tags              = EXCLUDED.tags,
			price             = EXCLUDED.price,
			registration_url  = EXCLUDED.registration_url,
			duration          = EXCLUDED.duration,
			agenda_html       = EXCLUDED.agenda_html,
			speakers_json     = EXCLUDED.speakers_json,
			prerequisites     = EXCLUDED.prerequisites,
			max_attendees     = EXCLUDED.max_attendees,
			attendees_count   = EXCLUDED.attendees_count,
			last_scraped      = NOW(),
			scraped_body      = EXCLUDED.scraped_body,
			updated_at        = NOW()
	`,
		detail.EventID, detail.FullDescription, detail.Organizer, detail.OrganizerContact,
		detail.ImageURL, detail.Tags, detail.Price, detail.RegistrationURL, detail.Duration,
		detail.AgendaHTML, detail.SpeakersJSON, detail.Prerequisites,
		detail.MaxAttendees, detail.AttendeesCount, detail.ScrapedBody,
	)

	return !exists, err
}

// ─── Scraper Health ───────────────────────────────────────────────────────────

type ScraperRunRow struct {
	ID              int64   `json:"id"`
	ScraperName     string  `json:"scraper_name"`
	Success         bool    `json:"success"`
	EventsFound     int     `json:"events_found"`
	EventsFiltered  int     `json:"events_filtered"`
	ErrorMessage    string  `json:"error_message"`
	DurationSeconds float64 `json:"duration_seconds"`
	RunAt           string  `json:"run_at"`
}

type ScraperSummary struct {
	Name        string          `json:"name"`
	LastRun     string          `json:"last_run"`
	LastSuccess bool            `json:"last_success"`
	SuccessRate float64         `json:"success_rate"`
	TotalRuns   int             `json:"total_runs"`
	RecentRuns  []ScraperRunRow `json:"recent_runs"`
}

func (s *Server) handleScraperHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := s.db.Query(`
		SELECT id, scraper_name, success, events_found, events_filtered,
		       COALESCE(error_message, ''), duration_seconds,
		       to_char(run_at, 'YYYY-MM-DD HH24:MI:SS') as run_at
		FROM (
			SELECT *,
			       ROW_NUMBER() OVER (PARTITION BY scraper_name ORDER BY run_at DESC) as rn
			FROM scraper_runs
		) sub
		WHERE rn <= 10
		ORDER BY scraper_name, run_at DESC
	`)
	if err != nil {
		jsonError(w, "Failed to fetch scraper health: "+err.Error(), 500)
		return
	}
	defer rows.Close()

	scraperMap := make(map[string][]ScraperRunRow)
	var orderedNames []string

	for rows.Next() {
		var row ScraperRunRow
		if err := rows.Scan(&row.ID, &row.ScraperName, &row.Success, &row.EventsFound,
			&row.EventsFiltered, &row.ErrorMessage, &row.DurationSeconds, &row.RunAt); err != nil {
			continue
		}
		if _, exists := scraperMap[row.ScraperName]; !exists {
			orderedNames = append(orderedNames, row.ScraperName)
		}
		scraperMap[row.ScraperName] = append(scraperMap[row.ScraperName], row)
	}

	var summaries []ScraperSummary
	for _, name := range orderedNames {
		runs := scraperMap[name]
		successCount := 0
		for _, r := range runs {
			if r.Success {
				successCount++
			}
		}
		summary := ScraperSummary{
			Name:        name,
			TotalRuns:   len(runs),
			SuccessRate: float64(successCount) / float64(len(runs)) * 100,
			RecentRuns:  runs,
		}
		if len(runs) > 0 {
			summary.LastRun = runs[0].RunAt
			summary.LastSuccess = runs[0].Success
		}
		summaries = append(summaries, summary)
	}

	jsonOK(w, map[string]interface{}{
		"scrapers":       summaries,
		"total_scrapers": len(summaries),
	})
}

// ─── Routing ──────────────────────────────────────────────────────────────────

func (s *Server) handleEventRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/events/")
	parts := strings.Split(path, "/")

	if len(parts) < 1 {
		jsonError(w, "Invalid URL", 400)
		return
	}

	if _, err := strconv.ParseInt(parts[0], 10, 64); err != nil {
		jsonError(w, "Invalid event ID", 400)
		return
	}

	if len(parts) == 1 {
		s.optionalAuth(s.handleEventDetail)(w, r)
	} else if len(parts) == 2 {
		switch parts[1] {
		case "recommended":
			s.handleRecommendedEvents(w, r)
		case "save":
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ✅ distinctCities now reads from city_normalized column — clean names only
func (s *Server) distinctCities() []string {
	rows, err := s.db.Query(`
		SELECT DISTINCT city_normalized
		FROM events
		WHERE city_normalized IS NOT NULL
		  AND city_normalized != ''
		  AND city_normalized != 'Unknown'
		ORDER BY city_normalized ASC
	`)
	if err != nil {
		return []string{}
	}
	defer rows.Close()

	var cities []string
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err == nil && c != "" {
			cities = append(cities, c)
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

type contextKey string

const userIDKey contextKey = "userID"

func getUserID(r *http.Request) string {
	userID, _ := r.Context().Value(userIDKey).(string)
	return userID
}

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