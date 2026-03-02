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
)

type OllamaDetailExtractor struct {
	baseURL string
	model   string
	client  *http.Client
}

func NewOllamaDetailExtractorFromEnv() *OllamaDetailExtractor {
	baseURL := os.Getenv("OLLAMA_URL")
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}

	model := os.Getenv("OLLAMA_DETAILS_MODEL")
	if model == "" {
		model = os.Getenv("OLLAMA_MODEL")
		if model == "" {
			model = "gemma2:2b"
		}
	}

	return &OllamaDetailExtractor{
		baseURL: baseURL,
		model:   model,
		client:  &http.Client{Timeout: 10 * time.Minute},
	}
}

type ollamaDetailsGenerateRequest struct {
	Model   string `json:"model"`
	Prompt  string `json:"prompt"`
	Stream  bool   `json:"stream"`
	Options struct {
		Temperature float64 `json:"temperature,omitempty"`
	} `json:"options,omitempty"`
}

type ollamaDetailsGenerateResponse struct {
	Response string `json:"response"`
}

type ExtractedEventDetail struct {
	FullDescription  string   `json:"full_description"`
	Organizer        string   `json:"organizer"`
	OrganizerContact string   `json:"organizer_contact"`
	ImageURL         string   `json:"image_url"`
	Tags             []string `json:"tags"`
	Price            string   `json:"price"`
	RegistrationURL  string   `json:"registration_url"`
	Duration         string   `json:"duration"`
	AgendaHTML       string   `json:"agenda_html"`
	Speakers         []string `json:"speakers"`
	Prerequisites    string   `json:"prerequisites"`
	MaxAttendees     int      `json:"max_attendees"`
}

func (x *OllamaDetailExtractor) ExtractDetailFromHTML(
	ctx context.Context,
	eventURL string,
	pageHTML string,
) (*ExtractedEventDetail, error) {

	// Keep prompt size manageable for gemma2:2b
	pageHTML = truncateDetails(pageHTML, 12000)

	prompt := fmt.Sprintf(`Return ONLY valid JSON. No markdown. No explanation. No extra text.
No code fences. Just the raw JSON object starting with { and ending with }.

You are an intelligent event detail extractor. Your task is to carefully read the HTML
of an event page and extract structured event information.

IMPORTANT INSTRUCTIONS:
- Read the HTML carefully. Look for event descriptions in paragraphs, divs, articles.
- The full_description should be a clear, human-readable 5-7 line description of the event.
  Remove all HTML tags, scripts, styles, and formatting artifacts.
  Write in clear, grammatically correct English that a human can easily understand.
- Look for organizer info, pricing, registration links, speaker names, agenda, etc.
- If a field is truly not present in the HTML, use "" for strings, [] for arrays, or 0 for numbers.
- Do NOT guess or make up information. Only extract what is clearly stated in the HTML.
- For image_url: look for og:image meta tag, or main event banner image src.
- For registration_url: look for "Register", "Book", "Sign Up" links.
- For speakers: look for speaker names in the page content.

Output schema:
{
  "full_description": "Clear 5-7 line human-readable description of the event",
  "organizer": "Name of the organizing company or person",
  "organizer_contact": "Email or phone if found",
  "image_url": "URL of the main event image",
  "tags": ["relevant", "topic", "tags"],
  "price": "Free / Paid / specific price",
  "registration_url": "Direct link to register",
  "duration": "e.g. 2 hours, 3 days",
  "agenda_html": "Brief agenda or schedule if available",
  "speakers": ["Speaker Name 1", "Speaker Name 2"],
  "prerequisites": "Any requirements to attend",
  "max_attendees": 0
}

Event URL: %s

HTML content to analyze:
%s
`, eventURL, pageHTML)

	reqBody := ollamaDetailsGenerateRequest{
		Model:  x.model,
		Prompt: prompt,
		Stream: false,
	}
	reqBody.Options.Temperature = 0.1

	b, _ := json.Marshal(reqBody)

	// Retry logic for robustness
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		reqCtx, cancel := context.WithTimeout(ctx, 8*time.Minute)

		req, err := http.NewRequestWithContext(reqCtx, "POST", x.baseURL+"/api/generate", bytes.NewBuffer(b))
		if err != nil {
			cancel()
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := x.client.Do(req)
		if err != nil {
			cancel()
			lastErr = fmt.Errorf("ollama details request failed: %w", err)
			continue
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			cancel()
			return nil, fmt.Errorf("ollama details non-2xx status=%d body=%s", resp.StatusCode, string(body))
		}

		var out ollamaDetailsGenerateResponse
		if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
			resp.Body.Close()
			cancel()
			lastErr = fmt.Errorf("decode ollama details response: %w", err)
			continue
		}
		resp.Body.Close()
		cancel()

		// Log raw response for debugging
		fmt.Printf("   🦙 Detail LLM response (%d chars)\n", len(out.Response))

		objBytes, err := extractJSONObject(out.Response)
		if err != nil {
			lastErr = fmt.Errorf("ollama did not return a JSON object: %w\nraw=%s", err, out.Response)
			continue
		}

		var detail ExtractedEventDetail
		if err := json.Unmarshal(objBytes, &detail); err != nil {
			lastErr = fmt.Errorf("failed to parse details JSON: %w\njson=%s", err, string(objBytes))
			continue
		}

		return &detail, nil
	}

	return nil, lastErr
}

func truncateDetails(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// extractJSONObject finds first {...} JSON object in a string (robust for LLM chatter)
func extractJSONObject(s string) ([]byte, error) {
	b := []byte(s)

	start := bytes.IndexByte(b, '{')
	if start == -1 {
		return nil, fmt.Errorf("no '{' found")
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

		if c == '{' {
			depth++
		} else if c == '}' {
			depth--
			if depth == 0 {
				return bytes.TrimSpace(b[start : i+1]), nil
			}
		}
	}

	return nil, fmt.Errorf("no matching '}' found")
}