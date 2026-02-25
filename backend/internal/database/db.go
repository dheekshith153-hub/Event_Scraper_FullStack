package database

import (
	"database/sql"
	"event-scraper/internal/models"
	"fmt"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

type DB struct {
	conn *sql.DB
}

func New(sqlDB *sql.DB) (*DB, error) {
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	db := &DB{conn: sqlDB}
	return db, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}

// GetConn returns the underlying sql.DB connection
func (db *DB) GetConn() *sql.DB {
	return db.conn
}

// Migrate creates/updates database schema
func (db *DB) Migrate() error {
	queries := []string{
		// Events table
		`CREATE TABLE IF NOT EXISTS events (
			id SERIAL PRIMARY KEY,
			event_name TEXT NOT NULL,
			location TEXT,
			city_normalized TEXT DEFAULT 'Unknown',
			date_time TEXT,
			date TEXT,
			time TEXT,
			website TEXT,
			description TEXT,
			address TEXT,
			event_type TEXT,
			platform TEXT NOT NULL,
			hash TEXT UNIQUE,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,

		// Event details table
		`CREATE TABLE IF NOT EXISTS event_details (
			id SERIAL PRIMARY KEY,
			event_id INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
			full_description TEXT,
			organizer TEXT,
			organizer_contact TEXT,
			image_url TEXT,
			tags TEXT,
			price TEXT,
			registration_url TEXT,
			duration TEXT,
			agenda_html TEXT,
			speakers_json TEXT,
			prerequisites TEXT,
			max_attendees INTEGER DEFAULT 0,
			attendees_count INTEGER DEFAULT 0,
			last_scraped TIMESTAMP DEFAULT NOW(),
			scraped_body TEXT,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,

		// Saved events table
		`CREATE TABLE IF NOT EXISTS saved_events (
			id SERIAL PRIMARY KEY,
			user_id TEXT NOT NULL,
			event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
			notes TEXT,
			saved_at TIMESTAMP DEFAULT NOW(),
			created_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(user_id, event_id)
		)`,

		// Scraper health runs table
		`CREATE TABLE IF NOT EXISTS scraper_runs (
			id SERIAL PRIMARY KEY,
			scraper_name VARCHAR(100) NOT NULL,
			success BOOLEAN NOT NULL DEFAULT false,
			events_found INTEGER DEFAULT 0,
			events_filtered INTEGER DEFAULT 0,
			error_message TEXT,
			duration_seconds REAL DEFAULT 0,
			run_at TIMESTAMP NOT NULL DEFAULT NOW()
		)`,

		// Add city_normalized to existing tables (safe — IF NOT EXISTS)
		`ALTER TABLE events ADD COLUMN IF NOT EXISTS city_normalized TEXT DEFAULT 'Unknown'`,

		// Standard indexes
		`CREATE INDEX IF NOT EXISTS idx_events_platform ON events(platform)`,
		`CREATE INDEX IF NOT EXISTS idx_events_hash ON events(hash)`,
		`CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_events_city_normalized ON events(city_normalized)`,
		`CREATE INDEX IF NOT EXISTS idx_event_details_event_id ON event_details(event_id)`,
		`CREATE INDEX IF NOT EXISTS idx_event_details_last_scraped ON event_details(last_scraped)`,
		`CREATE INDEX IF NOT EXISTS idx_saved_events_user_id ON saved_events(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_saved_events_event_id ON saved_events(event_id)`,
		`CREATE INDEX IF NOT EXISTS idx_scraper_runs_name ON scraper_runs(scraper_name)`,
		`CREATE INDEX IF NOT EXISTS idx_scraper_runs_run_at ON scraper_runs(run_at DESC)`,

		// Unique index on website URL — database-level hard stop against URL duplicates.
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_events_website_unique
		 ON events(website)
		 WHERE website IS NOT NULL AND website != ''`,
	}

	for _, query := range queries {
		if _, err := db.conn.Exec(query); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	return nil
}

// RecordScraperRun inserts a scraper execution record for health monitoring.
func (db *DB) RecordScraperRun(name string, success bool, eventsFound, eventsFiltered int, errMsg string, durationSecs float64) error {
	_, err := db.conn.Exec(`
		INSERT INTO scraper_runs (scraper_name, success, events_found, events_filtered, error_message, duration_seconds, run_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`, name, success, eventsFound, eventsFiltered, errMsg, durationSecs)
	return err
}

// ScraperHealthRow represents one scraper run record.
type ScraperHealthRow struct {
	ID              int64   `json:"id"`
	ScraperName     string  `json:"scraper_name"`
	Success         bool    `json:"success"`
	EventsFound     int     `json:"events_found"`
	EventsFiltered  int     `json:"events_filtered"`
	ErrorMessage    string  `json:"error_message"`
	DurationSeconds float64 `json:"duration_seconds"`
	RunAt           string  `json:"run_at"`
}

// GetScraperHealth returns the last N runs for each scraper.
func (db *DB) GetScraperHealth(runsPerScraper int) ([]ScraperHealthRow, error) {
	if runsPerScraper <= 0 {
		runsPerScraper = 10
	}

	rows, err := db.conn.Query(`
		SELECT id, scraper_name, success, events_found, events_filtered,
		       COALESCE(error_message, ''), duration_seconds,
		       to_char(run_at, 'YYYY-MM-DD HH24:MI:SS') as run_at
		FROM (
			SELECT *,
			       ROW_NUMBER() OVER (PARTITION BY scraper_name ORDER BY run_at DESC) as rn
			FROM scraper_runs
		) sub
		WHERE rn <= $1
		ORDER BY scraper_name, run_at DESC
	`, runsPerScraper)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ScraperHealthRow
	for rows.Next() {
		var r ScraperHealthRow
		if err := rows.Scan(&r.ID, &r.ScraperName, &r.Success, &r.EventsFound,
			&r.EventsFiltered, &r.ErrorMessage, &r.DurationSeconds, &r.RunAt); err != nil {
			continue
		}
		results = append(results, r)
	}
	return results, nil
}

// InsertEvent inserts or updates a single event with two dedup layers:
//   - Layer 1: hash match  → update existing row
//   - Layer 2: website URL match → update existing row
func (db *DB) InsertEvent(event *models.Event) error {
	event.Normalize()
	event.GenerateHash()

	if !event.IsValid() {
		return fmt.Errorf("invalid event")
	}

	// Layer 1: hash-based dedup
	var existingID int64
	err := db.conn.QueryRow(
		"SELECT id FROM events WHERE hash = $1",
		event.Hash,
	).Scan(&existingID)
	if err == nil {
		return db.UpdateEvent(existingID, event)
	} else if err != sql.ErrNoRows {
		return err
	}

	// Layer 2: URL-based dedup
	website := strings.TrimSpace(event.Website)
	if website != "" {
		err = db.conn.QueryRow(
			"SELECT id FROM events WHERE website = $1",
			website,
		).Scan(&existingID)
		if err == nil {
			return db.UpdateEvent(existingID, event)
		} else if err != sql.ErrNoRows {
			return err
		}
	}

	// Fresh insert
	query := `
		INSERT INTO events (
			event_name, location, city_normalized, date_time, date, time,
			website, description, event_type, platform, hash,
			address, created_at, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		ON CONFLICT (hash) DO UPDATE SET
			event_name      = EXCLUDED.event_name,
			location        = EXCLUDED.location,
			city_normalized = EXCLUDED.city_normalized,
			date_time       = EXCLUDED.date_time,
			date            = EXCLUDED.date,
			time            = EXCLUDED.time,
			website         = EXCLUDED.website,
			description     = EXCLUDED.description,
			event_type      = EXCLUDED.event_type,
			address         = EXCLUDED.address,
			updated_at      = EXCLUDED.updated_at
		RETURNING id
	`

	now := time.Now()
	return db.conn.QueryRow(
		query,
		event.EventName, event.Location, event.CityNormalized,
		event.DateTime, event.Date, event.Time,
		event.Website, event.Description, event.EventType, event.Platform,
		event.Hash, event.Address, now, now,
	).Scan(&event.ID)
}

func (db *DB) UpdateEvent(id int64, event *models.Event) error {
	query := `
		UPDATE events SET
			event_name=$1, location=$2, city_normalized=$3,
			date_time=$4, date=$5, time=$6,
			website=$7, description=$8, event_type=$9,
			address=$10, updated_at=$11
		WHERE id=$12
	`
	_, err := db.conn.Exec(
		query,
		event.EventName, event.Location, event.CityNormalized,
		event.DateTime, event.Date, event.Time,
		event.Website, event.Description, event.EventType,
		event.Address, time.Now(), id,
	)
	return err
}

// GetStats returns database statistics
func (db *DB) GetStats() (map[string]int, error) {
	stats := make(map[string]int)

	var total int
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM events").Scan(&total); err != nil {
		return nil, err
	}
	stats["total"] = total

	rows, err := db.conn.Query("SELECT platform, COUNT(*) FROM events GROUP BY platform")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var platform string
		var count int
		if err := rows.Scan(&platform, &count); err == nil {
			stats[platform] = count
		}
	}

	return stats, nil
}

// InsertBatch inserts multiple events in a single transaction.
func (db *DB) InsertBatch(events []models.Event) (int, int, error) {
	if len(events) == 0 {
		return 0, 0, nil
	}

	tx, err := db.conn.Begin()
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	inserted := 0
	skipped := 0
	now := time.Now()

	insertStmt, err := tx.Prepare(`
		INSERT INTO events (
			event_name, location, city_normalized, date_time, date, time,
			website, description, event_type, platform, hash,
			address, created_at, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		ON CONFLICT (hash) DO UPDATE SET
			event_name      = EXCLUDED.event_name,
			location        = EXCLUDED.location,
			city_normalized = EXCLUDED.city_normalized,
			date_time       = EXCLUDED.date_time,
			date            = EXCLUDED.date,
			time            = EXCLUDED.time,
			website         = EXCLUDED.website,
			description     = EXCLUDED.description,
			event_type      = EXCLUDED.event_type,
			address         = EXCLUDED.address,
			updated_at      = EXCLUDED.updated_at
	`)
	if err != nil {
		return 0, 0, err
	}
	defer insertStmt.Close()

	updateByURLStmt, err := tx.Prepare(`
		UPDATE events SET
			event_name=$1, location=$2, city_normalized=$3,
			date_time=$4, date=$5, description=$6,
			event_type=$7, address=$8, updated_at=$9
		WHERE website = $10
	`)
	if err != nil {
		return 0, 0, err
	}
	defer updateByURLStmt.Close()

	for _, event := range events {
		event.Normalize()
		event.GenerateHash()

		if !event.IsValid() {
			skipped++
			continue
		}

		// Layer 2: URL-based dedup
		website := strings.TrimSpace(event.Website)
		if website != "" {
			var existingID int64
			err := tx.QueryRow(
				"SELECT id FROM events WHERE website = $1", website,
			).Scan(&existingID)
			if err == nil {
				_, _ = updateByURLStmt.Exec(
					event.EventName, event.Location, event.CityNormalized,
					event.DateTime, event.Date, event.Description,
					event.EventType, event.Address, now,
					website,
				)
				skipped++
				continue
			}
		}

		// Layer 1: hash conflict via ON CONFLICT
		_, err := insertStmt.Exec(
			event.EventName,
			event.Location,
			event.CityNormalized,
			event.DateTime,
			event.Date,
			event.Time,
			event.Website,
			event.Description,
			event.EventType,
			event.Platform,
			event.Hash,
			event.Address,
			now,
			now,
		)
		if err != nil {
			skipped++
			continue
		}
		inserted++
	}

	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}
	return inserted, skipped, nil
}

// GetEvents is used by the API handler to fetch filtered, paginated events.
// Returns: events, total count, sorted city list (for filter dropdown), error.
func (db *DB) GetEvents(city, search, dateFrom, dateTo string, page, pageSize int) ([]models.Event, int, []string, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 8
	}
	offset := (page - 1) * pageSize

	conditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if city != "" {
		conditions = append(conditions, fmt.Sprintf("city_normalized = $%d", argIdx))
		args = append(args, city)
		argIdx++
	}

	if search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(event_name ILIKE $%d OR description ILIKE $%d OR location ILIKE $%d)",
			argIdx, argIdx, argIdx,
		))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if dateFrom != "" {
		conditions = append(conditions, fmt.Sprintf("date >= $%d", argIdx))
		args = append(args, dateFrom)
		argIdx++
	}

	if dateTo != "" {
		conditions = append(conditions, fmt.Sprintf("date <= $%d", argIdx))
		args = append(args, dateTo)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	// Total count
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM events WHERE %s", where)
	if err := db.conn.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, nil, fmt.Errorf("count query failed: %w", err)
	}

	// Paginated events, interleaved by platform
	dataQuery := fmt.Sprintf(`
		SELECT id, event_name, location, city_normalized, date_time, date, time,
		       website, description, address, event_type, platform, hash,
		       created_at, updated_at
		FROM (
			SELECT *,
			       ROW_NUMBER() OVER (PARTITION BY platform ORDER BY created_at DESC) AS rn
			FROM events
			WHERE %s
		) sub
		ORDER BY rn, platform, created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)

	args = append(args, pageSize, offset)

	rows, err := db.conn.Query(dataQuery, args...)
	if err != nil {
		return nil, 0, nil, fmt.Errorf("data query failed: %w", err)
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var e models.Event
		if err := rows.Scan(
			&e.ID, &e.EventName, &e.Location, &e.CityNormalized,
			&e.DateTime, &e.Date, &e.Time,
			&e.Website, &e.Description, &e.Address,
			&e.EventType, &e.Platform, &e.Hash,
			&e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			continue
		}
		events = append(events, e)
	}

	// Distinct cities for filter dropdown
	cityRows, err := db.conn.Query(`
		SELECT DISTINCT city_normalized
		FROM events
		WHERE city_normalized != 'Unknown'
		ORDER BY city_normalized ASC
	`)
	if err != nil {
		return events, total, nil, nil
	}
	defer cityRows.Close()

	var cities []string
	for cityRows.Next() {
		var c string
		if err := cityRows.Scan(&c); err == nil {
			cities = append(cities, c)
		}
	}

	return events, total, cities, nil
}