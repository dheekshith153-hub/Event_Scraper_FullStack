package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
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

// GenerateDescriptionFromTitle takes only the event title (and optionally
// platform name) and returns a clean 6-line human-readable description.
// This is extremely fast — ~100 tokens in, ~200 tokens out.
func (d *OllamaDescriber) GenerateDescriptionFromTitle(ctx context.Context, title, platform string) (string, error) {
	prompt := fmt.Sprintf(`Write exactly 6 lines describing this tech event. Be informative and professional.
Do NOT use markdown, bullet points, or special formatting. Just plain text paragraphs.
Do NOT make up specific dates, prices, or speaker names.
Focus on: what the event is about, who should attend, what attendees will learn, and why it matters.

Event: %s
Platform: %s

Write the 6-line description now:`, title, platform)

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

	result := strings.TrimSpace(out.Response)

	// Clean up common LLM artifacts
	result = strings.ReplaceAll(result, "**", "")
	result = strings.ReplaceAll(result, "##", "")
	result = strings.ReplaceAll(result, "- ", "")

	// Limit to ~6 lines
	lines := strings.Split(result, "\n")
	var clean []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			clean = append(clean, line)
		}
		if len(clean) >= 6 {
			break
		}
	}

	return strings.Join(clean, "\n"), nil
}
