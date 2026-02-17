package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Database DatabaseConfig
	Scraper  ScraperConfig
	Logging  LoggingConfig
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type ScraperConfig struct {
	IntervalMinutes int
	TimeoutSeconds  int
	MaxRetries      int
	RateLimitDelay  time.Duration
}

type LoggingConfig struct {
	Level   string
	LogFile string
}

func Load() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	port, err := strconv.Atoi(getEnv("DB_PORT", "5432"))
	if err != nil {
		return nil, fmt.Errorf("invalid DB_PORT: %w", err)
	}

	intervalMinutes, err := strconv.Atoi(getEnv("SCRAPER_INTERVAL_MINUTES", "10"))
	if err != nil {
		return nil, fmt.Errorf("invalid SCRAPER_INTERVAL_MINUTES: %w", err)
	}

	timeoutSeconds, err := strconv.Atoi(getEnv("SCRAPER_TIMEOUT_SECONDS", "120"))
	if err != nil {
		return nil, fmt.Errorf("invalid SCRAPER_TIMEOUT_SECONDS: %w", err)
	}

	maxRetries, err := strconv.Atoi(getEnv("MAX_RETRIES", "3"))
	if err != nil {
		return nil, fmt.Errorf("invalid MAX_RETRIES: %w", err)
	}

	rateLimitDelay, err := strconv.Atoi(getEnv("RATE_LIMIT_DELAY_SECONDS", "2"))
	if err != nil {
		return nil, fmt.Errorf("invalid RATE_LIMIT_DELAY_SECONDS: %w", err)
	}

	return &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     port,
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "Dheekshith@15"),
			DBName:   getEnv("DB_NAME", "event_scraper"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Scraper: ScraperConfig{
			IntervalMinutes: intervalMinutes,
			TimeoutSeconds:  timeoutSeconds,
			MaxRetries:      maxRetries,
			RateLimitDelay:  time.Duration(rateLimitDelay) * time.Second,
		},
		Logging: LoggingConfig{
			Level:   getEnv("LOG_LEVEL", "info"),
			LogFile: getEnv("LOG_FILE", "logs/scraper.log"),
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (c *DatabaseConfig) ConnectionString() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode,
	)
}
