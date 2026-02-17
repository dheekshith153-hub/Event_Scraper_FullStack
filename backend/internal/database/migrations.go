package database

func (db *DB) Migrate() error {
	query := `
	CREATE TABLE IF NOT EXISTS events (
		id SERIAL PRIMARY KEY,
		event_name VARCHAR(500) NOT NULL,
		location VARCHAR(500),
		date_time VARCHAR(200),
		date VARCHAR(100),
		time VARCHAR(100),
		website VARCHAR(1000),
		description TEXT,
		event_type VARCHAR(50),
		platform VARCHAR(50) NOT NULL,
		hash VARCHAR(64) UNIQUE NOT NULL,
		address VARCHAR(1000),
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_events_platform ON events(platform);
	CREATE INDEX IF NOT EXISTS idx_events_hash ON events(hash);
	CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
	CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
	`

	_, err := db.conn.Exec(query)
	if err != nil {
		return err
	}

	// Ensure the address column exists in case the table was created before the update
	alterQuery := `ALTER TABLE events ADD COLUMN IF NOT EXISTS address VARCHAR(1000);`
	_, err = db.conn.Exec(alterQuery)
	return err
}
