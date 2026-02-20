package utils

import (
	"event-scraper/internal/models"
	"strings"
)

// RemoveDuplicates removes duplicate events based on hash
func RemoveDuplicates(events []models.Event) []models.Event {
	seen := make(map[string]bool)
	result := make([]models.Event, 0, len(events))

	for _, event := range events {
    	event.Normalize()
    	event.GenerateHash()     // just call it
    	hash := event.Hash       // then use the stored hash

    	if !seen[hash] {
        	seen[hash] = true
        	result = append(result, event)
    	}
}

	return result
}

// SimilarityScore calculates similarity between two strings (0-100)
func SimilarityScore(s1, s2 string) float64 {
	s1 = strings.ToLower(strings.TrimSpace(s1))
	s2 = strings.ToLower(strings.TrimSpace(s2))

	if s1 == s2 {
		return 100.0
	}

	// Simple word-based similarity
	words1 := strings.Fields(s1)
	words2 := strings.Fields(s2)

	if len(words1) == 0 || len(words2) == 0 {
		return 0.0
	}

	wordSet1 := make(map[string]bool)
	for _, word := range words1 {
		wordSet1[word] = true
	}

	matches := 0
	for _, word := range words2 {
		if wordSet1[word] {
			matches++
		}
	}

	similarity := float64(matches) / float64(max(len(words1), len(words2))) * 100.0
	return similarity
}

// Uses builtin max from Go 1.21+
