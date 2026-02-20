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

		// Standard indexes
		`CREATE INDEX IF NOT EXISTS idx_events_platform ON events(platform)`,
		`CREATE INDEX IF NOT EXISTS idx_events_hash ON events(hash)`,
		`CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_event_details_event_id ON event_details(event_id)`,
		`CREATE INDEX IF NOT EXISTS idx_event_details_last_scraped ON event_details(last_scraped)`,
		`CREATE INDEX IF NOT EXISTS idx_saved_events_user_id ON saved_events(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_saved_events_event_id ON saved_events(event_id)`,

		// ✅ FIX: Unique index on website URL — database-level hard stop against URL duplicates.
		// Partial index: only applies to non-null, non-empty website values.
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

// InsertEvent inserts or updates a single event with two dedup layers:
//   - Layer 1: hash match  → update existing row
//   - Layer 2: website URL match → update existing row (catches date-format hash misses)
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
	// Catches cases where the same event was scraped with a different date format,
	// producing a different hash but pointing to the exact same page.
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

	// Neither hash nor URL matched — safe to insert.
	// ON CONFLICT (hash) is a last-resort safety net for race conditions.
	query := `
		INSERT INTO events (
			event_name, location, date_time, date, time,
			website, description, event_type, platform, hash,
			address, created_at, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT (hash) DO UPDATE SET
			event_name  = EXCLUDED.event_name,
			location    = EXCLUDED.location,
			date_time   = EXCLUDED.date_time,
			date        = EXCLUDED.date,
			time        = EXCLUDED.time,
			website     = EXCLUDED.website,
			description = EXCLUDED.description,
			event_type  = EXCLUDED.event_type,
			address     = EXCLUDED.address,
			updated_at  = EXCLUDED.updated_at
		RETURNING id
	`

	now := time.Now()
	return db.conn.QueryRow(
		query,
		event.EventName, event.Location, event.DateTime, event.Date, event.Time,
		event.Website, event.Description, event.EventType, event.Platform,
		event.Hash, event.Address, now, now,
	).Scan(&event.ID)
}

func (db *DB) UpdateEvent(id int64, event *models.Event) error {
	query := `
		UPDATE events SET
			event_name=$1, location=$2, date_time=$3,
			date=$4, time=$5, website=$6,
			description=$7, event_type=$8, address=$9, updated_at=$10
		WHERE id=$11
	`
	_, err := db.conn.Exec(
		query,
		event.EventName, event.Location, event.DateTime,
		event.Date, event.Time, event.Website,
		event.Description, event.EventType, event.Address,
		time.Now(), id,
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
// Dedup layers per event:
//   - Layer 1: hash conflict → ON CONFLICT DO UPDATE (handled by prepared statement)
//   - Layer 2: website URL check → UPDATE existing row, skip INSERT
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

	// Prepared statement handles hash-based conflicts automatically.
	insertStmt, err := tx.Prepare(`
		INSERT INTO events (
			event_name, location, date_time, date, time,
			website, description, event_type, platform, hash,
			address, created_at, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT (hash) DO UPDATE SET
			event_name  = EXCLUDED.event_name,
			location    = EXCLUDED.location,
			date_time   = EXCLUDED.date_time,
			date        = EXCLUDED.date,
			time        = EXCLUDED.time,
			website     = EXCLUDED.website,
			description = EXCLUDED.description,
			event_type  = EXCLUDED.event_type,
			address     = EXCLUDED.address,
			updated_at  = EXCLUDED.updated_at
	`)
	if err != nil {
		return 0, 0, err
	}
	defer insertStmt.Close()

	// Prepared statement for URL-based updates.
	updateByURLStmt, err := tx.Prepare(`
		UPDATE events SET
			event_name=$1, location=$2, date_time=$3,
			date=$4, time=$5, description=$6,
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

		// Layer 2: URL-based dedup — check if this website already exists.
		// This catches recurring events where the hash changed (different date scraped)
		// but the event page URL is identical.
		website := strings.TrimSpace(event.Website)
		if website != "" {
			var existingID int64
			err := tx.QueryRow(
				"SELECT id FROM events WHERE website = $1", website,
			).Scan(&existingID)
			if err == nil {
				// URL already in DB — update it in place, don't insert a duplicate.
				_, _ = updateByURLStmt.Exec(
					event.EventName, event.Location, event.DateTime,
					event.Date, event.Time, event.Description,
					event.EventType, event.Address, now,
					website,
				)
				skipped++
				continue
			}
		}

		// Layer 1: hash conflict handled by ON CONFLICT in the prepared statement.
		_, err := insertStmt.Exec(
			event.EventName,
			event.Location,
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