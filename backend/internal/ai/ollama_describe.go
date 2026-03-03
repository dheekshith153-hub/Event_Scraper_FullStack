package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

// OllamaDescriber generates a short human-readable description from just the
// event title. This is a lightweight alternative to sending full HTML to the
// LLM — ideal for CPU-only systems where inference is slow.
type OllamaDescriber struct {
	baseURL string
	model   string
	client  *http.Client
}

func NewOllamaDescriberFromEnv() *OllamaDescriber {
	baseURL := os.Getenv("OLLAMA_URL")
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	model := os.Getenv("OLLAMA_MODEL")
	if model == "" {
		model = "gemma2:2b"
	}
	return &OllamaDescriber{
		baseURL: baseURL,
		model:   model,
		client:  &http.Client{Timeout: 3 * time.Minute},
	}
}

type describeRequest struct {
	Model   string `json:"model"`
	Prompt  string `json:"prompt"`
	Stream  bool   `json:"stream"`
	Options struct {
		Temperature float64 `json:"temperature"`
		NumPredict  int     `json:"num_predict"`
	} `json:"options"`
}

type describeResponse struct {
	Response string `json:"response"`
}

// Compiled once at startup — used by sanitizeDescription
var (
	rePhone   = regexp.MustCompile(`(?:\+91[\s\-]?)?[6-9]\d{9}|\+?[\d\s\-\(\)]{8,15}\d`)
	reEmail   = regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`)
	reURL     = regexp.MustCompile(`https?://\S+|www\.\S+`)
	rePIN     = regexp.MustCompile(`\b\d{6}\b`)
	reAddrNum = regexp.MustCompile(`(?i)\b(?:No\.?|Flat|Door\s+No\.?|Plot\s+No\.?|House\s+No\.?|Shop\s+No\.?)\s*\d+\w*`)
	reStreet  = regexp.MustCompile(`(?i)\d+\s*[,\-]?\s*(?:[A-Z][a-z]+\s+)*(?:Road|Street|St\.|Lane|Avenue|Colony|Nagar|Layout|Sector\s+\d+|Phase\s+\d+|Cross|Main)\b`)
	reMarkup  = regexp.MustCompile(`\*{1,2}|#{1,3} ?|- {1}`)
	reNumList = regexp.MustCompile(`^\d+[\.\)]\s*`)
	reSpaces  = regexp.MustCompile(`[ \t]+`)
)

// sanitizeDescription strips all PII and markdown artifacts from LLM output,
// then capitalises each sentence and ensures terminal punctuation.
func sanitizeDescription(raw string) string {
	// Strip markdown artifacts
	result := reMarkup.ReplaceAllString(raw, "")

	// Strip PII
	result = rePhone.ReplaceAllString(result, "")
	result = reEmail.ReplaceAllString(result, "")
	result = reURL.ReplaceAllString(result, "")
	result = rePIN.ReplaceAllString(result, "")
	result = reAddrNum.ReplaceAllString(result, "")
	result = reStreet.ReplaceAllString(result, "")

	// Fix line-by-line
	lines := strings.Split(result, "\n")
	var clean []string
	for _, line := range lines {
		line = reNumList.ReplaceAllString(strings.TrimSpace(line), "") // strip "1. "
		line = reSpaces.ReplaceAllString(line, " ")
		line = strings.TrimSpace(line)
		if line == "" || len(strings.Fields(line)) < 4 {
			continue
		}
		// Capitalise first letter
		line = strings.ToUpper(line[:1]) + line[1:]
		// Ensure terminal punctuation
		if !strings.ContainsAny(string(line[len(line)-1]), ".!?") {
			line += "."
		}
		clean = append(clean, line)
		if len(clean) >= 6 {
			break
		}
	}

	return strings.Join(clean, "\n")
}

// GenerateDescriptionFromTitle takes only the event title (and optionally
// platform name) and returns a clean 6-line human-readable description.
func (d *OllamaDescriber) GenerateDescriptionFromTitle(ctx context.Context, title, platform string) (string, error) {
	prompt := fmt.Sprintf(`You are writing copy for a professional tech event listing website.
Write exactly 6 sentences describing this tech event.

STRICT RULES — violation makes the output unusable:
- Plain English sentences only. No bullet points, no markdown, no numbered lists.
- DO NOT include any phone numbers, mobile numbers, or contact numbers.
- DO NOT include any physical addresses, street names, building numbers, or PIN codes.
- DO NOT include any email addresses or website URLs.
- DO NOT include any WhatsApp, Telegram, Slack, or Discord links.
- DO NOT make up specific dates, ticket prices, or speaker names.
- Each sentence must be grammatically correct and end with a full stop.
- Focus on: what the event is about, who should attend, what they will learn, and why it matters.

Event: %s
Platform: %s

Write the 6-sentence description now:`, title, platform)

	reqBody := describeRequest{
		Model:  d.model,
		Prompt: prompt,
		Stream: false,
	}
	reqBody.Options.Temperature = 0.3
	reqBody.Options.NumPredict = 300

	b, _ := json.Marshal(reqBody)

	reqCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "POST", d.baseURL+"/api/generate", bytes.NewBuffer(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama describe request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ollama describe non-2xx status=%d body=%s", resp.StatusCode, string(body))
	}

	var out describeResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("decode ollama describe response: %w", err)
	}

	// Sanitize the LLM output before returning — catches anything the model
	// still produces despite the prompt rules
	return sanitizeDescription(out.Response), nil
}