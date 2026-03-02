package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"event-scraper/internal/models"
)

// CleanedEvent is the structured output from LLM cleaning.
// Used by both the OllamaCleaner and the scheduler for DB storage.
type CleanedEvent struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Date        string   `json:"date"`
	Time        string   `json:"time"`
	Location    string   `json:"location"`
	Address     string   `json:"address"`
	TechStack   []string `json:"tech_stack"`
	Speakers    []string `json:"speakers"`
	Organizer   string   `json:"organizer"`
	Price       string   `json:"price"`
	Confidence  int      `json:"confidence"`
	MissingData []string `json:"missing_data"`
	Summary     string   `json:"summary"`
	Highlights  []string `json:"highlights"`
}

type OllamaCleaner struct {
	baseURL string
	model   string
	client  *http.Client
}

func NewOllamaCleanerFromEnv() *OllamaCleaner {
	baseURL := os.Getenv("OLLAMA_URL")
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	model := os.Getenv("OLLAMA_MODEL")
	if model == "" {
		model = "gemma2:2b"
	}

	return &OllamaCleaner{
		baseURL: baseURL,
		model:   model,
		// IMPORTANT: ollama can take time to respond, especially first token
		client: &http.Client{Timeout: 10 * time.Minute},
	}
}

type ollamaGenerateRequest struct {
	Model   string `json:"model"`
	Prompt  string `json:"prompt"`
	Stream  bool   `json:"stream"`
	Options struct {
		Temperature float64 `json:"temperature,omitempty"`
		NumPredict  int     `json:"num_predict,omitempty"`
	} `json:"options,omitempty"`
}

type ollamaGenerateResponse struct {
	Response string `json:"response"`
}

func (c *OllamaCleaner) CleanEventBatch(
	ctx context.Context,
	events []models.Event,
	details []*models.EventDetail,
) ([]CleanedEvent, error) {

	// Process in small chunks to avoid huge prompts for gemma2:2b
	const chunkSize = 2

	var all []CleanedEvent
	for i := 0; i < len(events); i += chunkSize {
		end := i + chunkSize
		if end > len(events) {
			end = len(events)
		}

		subEvents := events[i:end]
		subDetails := []*models.EventDetail{}
		if i < len(details) {
			detailEnd := end
			if detailEnd > len(details) {
				detailEnd = len(details)
			}
			subDetails = details[i:detailEnd]
		}

		cleaned, err := c.cleanChunk(ctx, subEvents, subDetails)
		if err != nil {
			fmt.Printf("   ⚠️  LLM chunk %d-%d failed: %v (skipping)\n", i, end, err)
			// On chunk failure, create fallback entries so we don't lose events
			for j := range subEvents {
				e := subEvents[j]
				all = append(all, CleanedEvent{
					Title:       e.EventName,
					Description: e.Description,
					Date:        e.Date,
					Time:        e.Time,
					Location:    e.Location,
					Address:     e.Address,
					Confidence:  0,
					MissingData: []string{"llm_failed"},
					Summary:     e.Description,
				})
			}
			continue
		}
		all = append(all, cleaned...)
	}

	return all, nil
}

func (c *OllamaCleaner) cleanChunk(
	ctx context.Context,
	events []models.Event,
	details []*models.EventDetail,
) ([]CleanedEvent, error) {

	prompt := buildOllamaPrompt(events, details)

	reqBody := ollamaGenerateRequest{
		Model:  c.model,
		Prompt: prompt,
		Stream: false,
	}
	reqBody.Options.Temperature = 0.2

	b, _ := json.Marshal(reqBody)

	// Give ollama enough time (model may be "cold")
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	// Retry: sometimes first call stalls
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		req, err := http.NewRequestWithContext(reqCtx, "POST", c.baseURL+"/api/generate", bytes.NewBuffer(b))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("ollama request failed: %w", err)
			continue
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("ollama non-2xx status=%d body=%s", resp.StatusCode, string(body))
		}

		var out ollamaGenerateResponse
		if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
			resp.Body.Close()
			return nil, fmt.Errorf("decode ollama response: %w", err)
		}
		resp.Body.Close()

		// Log raw LLM response for debugging
		fmt.Printf("   🦙 LLM raw response (%d chars): %.200s...\n", len(out.Response), out.Response)

		jsonBytes, err := extractJSONArray(out.Response)
		if err != nil {
			lastErr = fmt.Errorf("ollama did not return a JSON array: %w\nraw=%s", err, out.Response)
			continue
		}

		// Log the clean JSON before DB storage
		fmt.Printf("   📋 Cleaned JSON result:\n%s\n", string(jsonBytes))

		var cleaned []CleanedEvent
		if err := json.Unmarshal(jsonBytes, &cleaned); err != nil {
			lastErr = fmt.Errorf("failed to parse cleaned JSON: %w\njson=%s", err, string(jsonBytes))
			continue
		}

		return cleaned, nil
	}

	return nil, lastErr
}

func buildOllamaPrompt(events []models.Event, details []*models.EventDetail) string {
	type item struct {
		ID          int64  `json:"id"`
		Title       string `json:"title"`
		Date        string `json:"date"`
		Time        string `json:"time"`
		Location    string `json:"location"`
		Address     string `json:"address"`
		Description string `json:"description"`
		FullDetails string `json:"full_details"`
		Platform    string `json:"platform"`
		Website     string `json:"website"`
	}

	payload := make([]item, 0, len(events))
	for i, e := range events {
		full := ""
		if i < len(details) && details[i] != nil {
			full = details[i].FullDescription
		}

		// Truncate to keep prompt small for gemma2:2b
		full = truncate(full, 1200)
		desc := truncate(e.Description, 600)

		payload = append(payload, item{
			ID:          e.ID,
			Title:       e.EventName,
			Date:        e.Date,
			Time:        e.Time,
			Location:    e.Location,
			Address:     e.Address,
			Description: desc,
			FullDetails: full,
			Platform:    e.Platform,
			Website:     e.Website,
		})
	}

	inp, _ := json.Marshal(payload)

	return fmt.Sprintf(`Return ONLY a valid JSON array. No markdown. No explanation. No extra text.
No code fences. Just the raw JSON array starting with [ and ending with ].

You are an event data cleaning and formatting AI agent. Your job:
1. Clean and normalize event data into human-readable format.
2. Detect and merge DUPLICATE events (same event name or same URL = duplicate).
   For duplicates, keep only ONE entry with the most complete information.
3. Format descriptions as clear, readable 5-7 line summaries that a human can understand.
4. Extract structured information from raw scraped data.

Output schema — each item in the array MUST match this exact structure:
{
  "title": "Clean, properly capitalized event title",
  "description": "A clear 5-7 line human-readable description of the event. Include what the event is about, who it is for, key topics covered, and why someone should attend. Remove all HTML tags, special characters, and formatting artifacts.",
  "date": "YYYY-MM-DD format if possible, otherwise cleaned date string",
  "time": "HH:MM AM/PM format if possible, otherwise cleaned time string",
  "location": "Clean venue/city name",
  "address": "Full street address if available",
  "tech_stack": ["list", "of", "technologies", "mentioned"],
  "speakers": ["Speaker Name 1", "Speaker Name 2"],
  "organizer": "Organization or person hosting the event",
  "price": "Free / Paid / specific price",
  "confidence": 85,
  "missing_data": ["fields", "that", "were", "unknown"],
  "summary": "One clear sentence summarizing the event",
  "highlights": ["Key highlight 1", "Key highlight 2", "Key highlight 3"]
}

Rules:
- Do NOT guess or fabricate information. If a field is unknown, use "" for strings, [] for arrays, 0 for numbers, and add the field name to missing_data.
- Normalize city names (e.g. "bangalore" -> "Bengaluru", "bombay" -> "Mumbai").
- confidence is 0-100 indicating how complete the data is.
- Remove duplicate events from the output. If two events have the same title or URL, merge them into one.
- Keep output array order matching input order (after dedup).
- The description MUST be human-readable, grammatically correct English. Not raw HTML or gibberish.

INPUT:
%s
`, string(inp))
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// extractJSONArray finds first [...] JSON array in a string (robust for LLM chatter)
func extractJSONArray(s string) ([]byte, error) {
	b := []byte(s)

	start := bytes.IndexByte(b, '[')
	if start == -1 {
		return nil, fmt.Errorf("no '[' found")
	}

	depth := 0
	inString := false
	escape := false

	for i := start; i < len(b); i++ {
		c := b[i]

		if inString {
			if escape {
				escape = false
				continue
			}
			if c == '\\' {
				escape = true
				continue
			}
			if c == '"' {
				inString = false
			}
			continue
		}

		if c == '"' {
			inString = true
			continue
		}

		if c == '[' {
			depth++
		} else if c == ']' {
			depth--
			if depth == 0 {
				return bytes.TrimSpace(b[start : i+1]), nil
			}
		}
	}

	return nil, fmt.Errorf("no matching ']' found")
}