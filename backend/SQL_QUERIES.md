-- Event Scraper - Useful SQL Queries

-- ============================================
-- BASIC QUERIES
-- ============================================

-- Total number of events
SELECT COUNT(*) as total_events FROM events;

-- Events by platform
SELECT 
    platform, 
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM events), 2) as percentage
FROM events 
GROUP BY platform 
ORDER BY count DESC;

-- Events by type (Online/Offline)
SELECT 
    event_type, 
    COUNT(*) as count 
FROM events 
GROUP BY event_type;

-- Recent events (last 10)
SELECT 
    event_name, 
    platform, 
    location, 
    date, 
    created_at 
FROM events 
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================
-- FILTERING QUERIES
-- ============================================

-- Find events by platform
SELECT * FROM events WHERE platform = 'meetup' ORDER BY created_at DESC;

-- Find online events
SELECT event_name, platform, date FROM events WHERE event_type = 'Online';

-- Find offline events in specific city
SELECT event_name, platform, location, date 
FROM events 
WHERE event_type = 'Offline' 
AND location ILIKE '%bangalore%';

-- Search events by keyword
SELECT event_name, platform, location, date 
FROM events 
WHERE event_name ILIKE '%hackathon%' 
OR description ILIKE '%hackathon%';

-- ============================================
-- DATE-BASED QUERIES
-- ============================================

-- Events added today
SELECT COUNT(*) FROM events WHERE DATE(created_at) = CURRENT_DATE;

-- Events added in last 7 days
SELECT platform, COUNT(*) as count 
FROM events 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY platform;

-- Events added per day (last 30 days)
SELECT 
    DATE(created_at) as date,
    COUNT(*) as events_added
FROM events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- ANALYTICS QUERIES
-- ============================================

-- Most common event locations
SELECT 
    location, 
    COUNT(*) as count 
FROM events 
WHERE location IS NOT NULL 
AND location != ''
GROUP BY location 
ORDER BY count DESC 
LIMIT 20;

-- Average events per platform
SELECT 
    AVG(event_count) as avg_events_per_platform
FROM (
    SELECT platform, COUNT(*) as event_count
    FROM events
    GROUP BY platform
) sub;

-- Platforms with most events
SELECT 
    platform,
    COUNT(*) as total_events,
    COUNT(DISTINCT location) as unique_locations,
    COUNT(CASE WHEN event_type = 'Online' THEN 1 END) as online_events,
    COUNT(CASE WHEN event_type = 'Offline' THEN 1 END) as offline_events
FROM events
GROUP BY platform
ORDER BY total_events DESC;

-- ============================================
-- DUPLICATE DETECTION
-- ============================================

-- Find potential duplicates (same hash)
SELECT 
    hash,
    COUNT(*) as count,
    STRING_AGG(event_name, ' | ') as events
FROM events
GROUP BY hash
HAVING COUNT(*) > 1;

-- Find similar event names (might be duplicates)
SELECT 
    e1.event_name as event1,
    e2.event_name as event2,
    e1.platform as platform1,
    e2.platform as platform2,
    e1.location,
    e1.date
FROM events e1
JOIN events e2 ON e1.event_name = e2.event_name AND e1.id < e2.id
WHERE e1.platform != e2.platform
ORDER BY e1.event_name;

-- ============================================
-- DATA QUALITY QUERIES
-- ============================================

-- Events missing required fields
SELECT 
    COUNT(CASE WHEN event_name IS NULL OR event_name = '' THEN 1 END) as missing_name,
    COUNT(CASE WHEN location IS NULL OR location = '' THEN 1 END) as missing_location,
    COUNT(CASE WHEN date IS NULL OR date = '' THEN 1 END) as missing_date,
    COUNT(CASE WHEN website IS NULL OR website = '' THEN 1 END) as missing_website
FROM events;

-- Events by completeness
SELECT 
    CASE 
        WHEN website != '' THEN 'Complete'
        WHEN location != '' AND date != '' THEN 'Good'
        WHEN location != '' OR date != '' THEN 'Partial'
        ELSE 'Minimal'
    END as completeness,
    COUNT(*) as count
FROM events
GROUP BY completeness;

-- ============================================
-- EXPORT QUERIES
-- ============================================

-- Export all events to CSV (use with \copy in psql)
-- \copy (SELECT * FROM events ORDER BY created_at DESC) TO '/tmp/events.csv' CSV HEADER;

-- Export specific platform events
-- \copy (SELECT event_name, location, date, website FROM events WHERE platform = 'meetup') TO '/tmp/meetup_events.csv' CSV HEADER;

-- ============================================
-- MAINTENANCE QUERIES
-- ============================================

-- Delete old events (older than 90 days)
-- DELETE FROM events WHERE created_at < NOW() - INTERVAL '90 days';

-- Update event type for events with 'online' in location
UPDATE events 
SET event_type = 'Online' 
WHERE LOWER(location) LIKE '%online%' 
AND event_type != 'Online';

-- Vacuum database (reclaim space)
-- VACUUM ANALYZE events;

-- ============================================
-- ADVANCED QUERIES
-- ============================================

-- Find events with most similar names (fuzzy matching)
SELECT 
    e1.event_name,
    e1.platform,
    e2.event_name as similar_event,
    e2.platform as similar_platform,
    SIMILARITY(e1.event_name, e2.event_name) as similarity_score
FROM events e1
CROSS JOIN events e2
WHERE e1.id < e2.id
AND e1.event_name % e2.event_name  -- pg_trgm extension required
ORDER BY similarity_score DESC
LIMIT 20;

-- Monthly event trends
SELECT 
    TO_CHAR(created_at, 'YYYY-MM') as month,
    platform,
    COUNT(*) as events
FROM events
GROUP BY month, platform
ORDER BY month DESC, events DESC;

-- Peak scraping hours
SELECT 
    EXTRACT(HOUR FROM created_at) as hour,
    COUNT(*) as events_added
FROM events
GROUP BY hour
ORDER BY hour;

-- ============================================
-- INDEXING & PERFORMANCE
-- ============================================

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'events'
ORDER BY idx_scan DESC;

-- Table size
SELECT 
    pg_size_pretty(pg_total_relation_size('events')) as total_size,
    pg_size_pretty(pg_relation_size('events')) as table_size,
    pg_size_pretty(pg_total_relation_size('events') - pg_relation_size('events')) as index_size;

-- ============================================
-- USEFUL VIEWS
-- ============================================

-- Create view for complete events
CREATE OR REPLACE VIEW complete_events AS
SELECT *
FROM events
WHERE event_name != ''
  AND location != ''
  AND (date != '' OR date_time != '')
  AND website != '';

-- Create view for recent events
CREATE OR REPLACE VIEW recent_events AS
SELECT *
FROM events
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Use views
SELECT * FROM complete_events LIMIT 10;
SELECT platform, COUNT(*) FROM recent_events GROUP BY platform;
