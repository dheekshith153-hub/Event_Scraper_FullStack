package utils

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

// OllamaClassifier uses a local Ollama model to classify whether an event is tech-related.
type OllamaClassifier struct {
	baseURL string
	model   string
	client  *http.Client
}

// NewOllamaClassifier creates a classifier that talks to the local Ollama server.
func NewOllamaClassifier() *OllamaClassifier {
	baseURL := os.Getenv("OLLAMA_URL")
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	model := os.Getenv("OLLAMA_MODEL")
	if model == "" {
		model = "gemma2:2b"
	}

	return &OllamaClassifier{
		baseURL: strings.TrimRight(baseURL, "/"),
		model:   model,
		client:  &http.Client{Timeout: 2 * time.Minute},
	}
}

type classifyRequest struct {
	Model   string `json:"model"`
	Prompt  string `json:"prompt"`
	Stream  bool   `json:"stream"`
	Options struct {
		Temperature float64 `json:"temperature"`
		NumPredict  int     `json:"num_predict"`
	} `json:"options"`
}

type classifyResponse struct {
	Response string `json:"response"`
}

type classifyLabel string

const (
	labelTech       classifyLabel = "TECH"
	labelNonTech    classifyLabel = "NON-TECH"
	labelEduNonTech classifyLabel = "EDU-NON-TECH"
	labelUnknown    classifyLabel = "UNKNOWN"
)

// ClassifyTechEvent asks the LLM whether the event is a technology / engineering / IT event.
// Returns (isTech bool, reason string, err error).
//
// Behavior:
// - TECH        => (true,  reason, nil)
// - NON-TECH    => (false, reason, nil)
// - EDU-NON-TECH=> (false, "EDU-NON-TECH: <reason>", nil)   (filtered)
// - UNKNOWN     => (false, "UNKNOWN: <reason>", nil)        (filtered by default)
func (c *OllamaClassifier) ClassifyTechEvent(title, description string) (bool, string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return false, "missing title", nil
	}

	desc := strings.TrimSpace(description)
	if len(desc) > 700 {
		desc = desc[:700]
	}

	// ✅ Fast prefilter to remove education/demo spam WITHOUT calling the LLM
	if ok, why := eduSpamPreFilter(title, desc); ok {
		return false, "EDU-NON-TECH: " + why, nil
	}

	prompt := buildTechClassifierPromptV2(title, desc)

	reqBody := classifyRequest{
		Model:  c.model,
		Prompt: prompt,
		Stream: false,
	}
	// Classification -> deterministic
	reqBody.Options.Temperature = 0.0
	reqBody.Options.NumPredict = 90

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return false, "", fmt.Errorf("marshal ollama request: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/generate", bytes.NewBuffer(payload))
	if err != nil {
		return false, "", fmt.Errorf("create ollama request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return false, "", fmt.Errorf("ollama classify request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return false, "", fmt.Errorf("ollama classify non-2xx status=%d body=%s", resp.StatusCode, string(body))
	}

	var out classifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return false, "", fmt.Errorf("decode ollama classify response: %w", err)
	}

	raw := strings.TrimSpace(out.Response)
	label, reason := parseCategoryAndReason(raw)

	switch label {
	case labelTech:
		if reason == "" {
			reason = "tech-related"
		}
		return true, reason, nil

	case labelNonTech:
		if reason == "" {
			reason = "not tech-related"
		}
		return false, reason, nil

	case labelEduNonTech:
		if reason == "" {
			reason = "education/demo/coaching"
		}
		return false, "EDU-NON-TECH: " + reason, nil

	case labelUnknown:
		if reason == "" {
			reason = "insufficient info"
		}
		// Conservative default: UNKNOWN treated as non-tech
		return false, "UNKNOWN: " + reason, nil

	default:
		// Hard fallback: conservative
		if raw == "" {
			return false, "LLM response empty", nil
		}
		return false, "LLM response unclear: " + raw, nil
	}
}

// -------------------- Prefilter: education/demo spam --------------------

// eduSpamPreFilter returns true if this looks like education/demo/coaching noise
// and should be filtered out before calling the LLM.
func eduSpamPreFilter(title, desc string) (bool, string) {
	s := strings.ToLower(strings.TrimSpace(title + " " + desc))

	// Common junk patterns (adjust as you see in your dataset)
	patterns := []string{
		"demo class", "free demo", "demo classes",
		"day 01", "day 1", "day-1", "day01",
		"orientation", "admission", "admissions",
		"enroll", "enrol", "enrollment", "registration open",
		"batch", "new batch", "batch starts", "batch start",
		"syllabus", "curriculum",
		"tuition", "tuitions",
		"coaching", "academy", "institute",
		"classes", "course", "training class",

		// Exam prep / education industry
		"neet", "jee", "upsc", "ssc", "bank exam",
		"ielts", "toefl", "gre", "gmat", "cat",

		// Kids schooling style noise
		"school", "college", "kids", "nursery", "kindergarten",
	}

	for _, p := range patterns {
		if strings.Contains(s, p) {
			return true, "matched education/demo keyword: " + p
		}
	}

	return false, ""
}

// -------------------- Prompt --------------------

func buildTechClassifierPromptV2(title, desc string) string {
	// IMPORTANT: avoid the token "LABEL:" because some models echo it strangely.
	var b strings.Builder

	b.WriteString("You are a strict event classifier.\n\n")
	b.WriteString("Choose exactly ONE category:\n")
	b.WriteString("TECH\nNON-TECH\nEDU-NON-TECH\nUNKNOWN\n\n")

	b.WriteString("Definitions:\n")
	b.WriteString("- TECH: primary subject is technology or engineering.\n")
	b.WriteString("  Includes: software/coding, AI/ML, data science, cloud/DevOps, cybersecurity, IT infrastructure,\n")
	b.WriteString("  networking, blockchain, IoT, robotics, semiconductors, electronics, embedded systems, EV tech,\n")
	b.WriteString("  biotech/pharma tech (technology focus), fintech (technology focus), SaaS/devtools, hackathons.\n")
	b.WriteString("- EDU-NON-TECH: coaching/tuition/demo classes/admissions/batches/exam prep, or generic 'classes/course'\n")
	b.WriteString("  that is NOT clearly about a tech topic.\n")
	b.WriteString("- NON-TECH: music/dance/yoga/fitness, arts, food festivals, fashion, weddings, spiritual/astrology,\n")
	b.WriteString("  sports, real-estate, generic business networking, marketing/sales/HR events.\n")
	b.WriteString("- UNKNOWN: too vague to be sure.\n\n")

	b.WriteString("Rules:\n")
	b.WriteString("1) If title contains demo class/day 01/batch/admissions/coaching/tuition => EDU-NON-TECH.\n")
	b.WriteString("2) Workshops are TECH only if they explicitly mention tech topics (Python, AI, DevOps, etc).\n")
	b.WriteString("3) Expos are TECH only if the expo topic itself is technology (AI Expo TECH; Bakery Expo NON-TECH).\n")
	b.WriteString("4) If uncertain, output UNKNOWN. Prefer NON-TECH over TECH when unsure.\n\n")

	b.WriteString("Return ONLY ONE LINE:\n")
	b.WriteString("CATEGORY: reason (max 10 words)\n\n")

	b.WriteString("Examples:\n")
	b.WriteString(`Title: "React Bengaluru Meetup" -> TECH: Software developer meetup.` + "\n")
	b.WriteString(`Title: "Python Workshop for Beginners" -> TECH: Explicit programming workshop.` + "\n")
	b.WriteString(`Title: "Free Demo Classes | Day 01" -> EDU-NON-TECH: Demo/coaching session.` + "\n")
	b.WriteString(`Title: "Admissions Open for 2026 Batch" -> EDU-NON-TECH: Admissions/batch announcement.` + "\n")
	b.WriteString(`Title: "Bangalore Yoga & Breathwork" -> NON-TECH: Wellness event.` + "\n")
	b.WriteString(`Title: "Startup Pitch Night" -> UNKNOWN: Not clearly technology-specific.` + "\n")
	b.WriteString(`Title: "AI Startup Pitch Night" -> TECH: AI technology startup pitching.` + "\n\n")

	b.WriteString("Now classify:\n")
	b.WriteString("Event title: ")
	b.WriteString(title)
	b.WriteString("\n")

	if strings.TrimSpace(desc) != "" {
		b.WriteString("Event description: ")
		b.WriteString(desc)
		b.WriteString("\n")
	}

	return b.String()
}

// -------------------- Parsing --------------------

// parseCategoryAndReason parses model output robustly.
// Expected: "TECH: reason" or "NON-TECH: reason" or "EDU-NON-TECH: reason" or "UNKNOWN: reason"
func parseCategoryAndReason(s string) (classifyLabel, string) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", ""
	}

	// Strip common wrappers
	s = strings.Trim(s, "`\"' \n\t")

	// Only first line
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = strings.TrimSpace(s[:i])
	}

	upper := strings.ToUpper(s)

	// Exact prefix checks
	if strings.HasPrefix(upper, "TECH:") {
		return labelTech, strings.TrimSpace(s[len("TECH:"):])
	}
	if strings.HasPrefix(upper, "NON-TECH:") {
		return labelNonTech, strings.TrimSpace(s[len("NON-TECH:"):])
	}
	if strings.HasPrefix(upper, "EDU-NON-TECH:") {
		return labelEduNonTech, strings.TrimSpace(s[len("EDU-NON-TECH:"):])
	}
	if strings.HasPrefix(upper, "UNKNOWN:") {
		return labelUnknown, strings.TrimSpace(s[len("UNKNOWN:"):])
	}

	// Tolerant fallback: "TECH - reason"
	fields := strings.Fields(upper)
	if len(fields) > 0 {
		switch fields[0] {
		case "TECH":
			return labelTech, strings.TrimSpace(s[len(fields[0]):])
		case "NON-TECH", "NONTECH":
			return labelNonTech, strings.TrimSpace(s[len(fields[0]):])
		case "EDU-NON-TECH", "EDUNONTECH":
			return labelEduNonTech, strings.TrimSpace(s[len(fields[0]):])
		case "UNKNOWN":
			return labelUnknown, strings.TrimSpace(s[len(fields[0]):])
		}
	}

	// Last resort heuristic (conservative)
	if strings.Contains(upper, "EDU") || strings.Contains(upper, "COACH") || strings.Contains(upper, "DEMO CLASS") {
		return labelEduNonTech, s
	}
	if strings.Contains(upper, "NON-TECH") || strings.Contains(upper, "NOT TECH") {
		return labelNonTech, s
	}
	if strings.Contains(upper, "TECH") {
		return labelTech, s
	}

	return "", s
}