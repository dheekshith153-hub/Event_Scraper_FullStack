package database

import (
	"database/sql"
	"event-scraper/internal/models"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

type DB struct {
	conn *sql.DB
}

func New(connectionString string) (*DB, error) {
	conn, err := sql.Open("postgres", connectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	db := &DB{conn: conn}

	if err := db.Migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}

// InsertEvent inserts or updates an event
func (db *DB) InsertEvent(event *models.Event) error {
	event.Normalize()
	event.GenerateHash()

	if !event.IsValid() {
		return fmt.Errorf("invalid event")
	}

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

	query := `
		INSERT INTO events (
			event_name, location, date_time, date, time,
			website, description, event_type, platform, hash,
			address, created_at, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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

	// FIXED: scan into variable first
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

// InsertBatch inserts multiple events in a single transaction
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

	stmt, err := tx.Prepare(`
		INSERT INTO events (
			event_name, location, date_time, date, time,
			website, description, event_type, platform, hash,
			address, created_at, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT (hash) DO UPDATE SET
			event_name = EXCLUDED.event_name,
			location = EXCLUDED.location,
			date_time = EXCLUDED.date_time,
			date = EXCLUDED.date,
			time = EXCLUDED.time,
			website = EXCLUDED.website,
			description = EXCLUDED.description,
			event_type = EXCLUDED.event_type,
			address = EXCLUDED.address,
			updated_at = EXCLUDED.updated_at
	`)
	if err != nil {
		return 0, 0, err
	}
	defer stmt.Close()

	for _, event := range events {
		event.Normalize()
		event.GenerateHash()

		if !event.IsValid() {
			skipped++
			continue
		}

		_, err := stmt.Exec(
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
