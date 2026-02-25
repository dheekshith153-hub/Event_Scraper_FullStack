package utils

import (
	"strings"
	"unicode"
)

// cityAliases maps every known variant/typo → canonical city name.
var cityAliases = map[string]string{
	// Bengaluru variants
	"bangalore":  "Bengaluru",
	"banglore":   "Bengaluru",
	"bengaluru":  "Bengaluru",
	"bengalur":   "Bengaluru",
	"blr":        "Bengaluru",

	// Mumbai variants
	"mumbai": "Mumbai",
	"bombay": "Mumbai",

	// Delhi / NCR variants
	"new delhi": "New Delhi",
	"newdelhi":  "New Delhi",
	"delhi":     "New Delhi",
	"ndls":      "New Delhi",

	// Gurugram variants
	"gurugram": "Gurugram",
	"gurgaon":  "Gurugram",

	// Other cities
	"hyderabad":     "Hyderabad",
	"secunderabad":  "Hyderabad",
	"telangana":     "Hyderabad",
	"telengana":     "Hyderabad",
	"chennai":       "Chennai",
	"madras":        "Chennai",
	"pune":          "Pune",
	"kolkata":       "Kolkata",
	"calcutta":      "Kolkata",
	"ahmedabad":     "Ahmedabad",
	"ahmadabad":     "Ahmedabad",
	"rajkot":        "Rajkot",
	"vadodara":      "Vadodara",
	"baroda":        "Vadodara",
	"udaipur":       "Udaipur",
	"surat":         "Surat",
	"salem":         "Salem",
	"noida":         "Noida",
	"kochi":         "Kochi",
	"cochin":        "Kochi",
	"jaipur":        "Jaipur",
	"bhopal":        "Bhopal",
	"nagpur":        "Nagpur",
	"indore":        "Indore",
	"coimbatore":    "Coimbatore",
	"vizag":         "Visakhapatnam",
	"visakhapatnam": "Visakhapatnam",
	"online":        "Online",
	"virtual":       "Online",
	"remote":        "Online",
}

// venueToCity maps known venue/landmark/area names → canonical city.
// Keyed by lowercase normalized substring — longer/more specific keys first
// to avoid false matches.
var venueToCity = map[string]string{
	// ── Bengaluru ───────────────────────────────────────────────────────
	"bangalore international exhibition centre": "Bengaluru",
	"biec":                    "Bengaluru",
	"ikp eden":                "Bengaluru",
	"nimhans":                 "Bengaluru",
	"palace grounds":          "Bengaluru",
	"terralogic":              "Bengaluru",
	"designboat":              "Bengaluru",
	"bommasandra":             "Bengaluru",
	"gkvk":                    "Bengaluru",
	"madavara":                "Bengaluru",
	"hasura":                  "Bengaluru",
	"koramangala":             "Bengaluru",
	"whitefield":              "Bengaluru",
	"indiranagar":             "Bengaluru",
	"marathahalli":            "Bengaluru",
	"hebbal":                  "Bengaluru",
	"electronic city":         "Bengaluru",
	"jp nagar":                "Bengaluru",
	"jayanagar":               "Bengaluru",
	"malleswaram":             "Bengaluru",
	"yelahanka":               "Bengaluru",
	"devanahalli":             "Bengaluru",
	"bellandur":               "Bengaluru",
	"sarjapur":                "Bengaluru",
	"domlur":                  "Bengaluru",
	"btm layout":              "Bengaluru",
	"mg road":                 "Bengaluru",
	"ulsoor":                  "Bengaluru",
	"kaikondrahalli":          "Bengaluru",
	"jakkur":                  "Bengaluru",
	"rajajinagar":             "Bengaluru",
	"yeshwanthpur":            "Bengaluru",
	"peenya":                  "Bengaluru",
	"hsr layout":              "Bengaluru",
	"hsr":                     "Bengaluru",
	"urbanvault":              "Bengaluru", // "UrbanVault 477 HSR Layout"
	"91springboard":           "Bengaluru",
	"wework galaxy":           "Bengaluru",
	"draper startup":          "Bengaluru",
	"ktpo":                    "Bengaluru",

	// ── Mumbai ─────────────────────────────────────────────────────────
	"jio world":         "Mumbai",
	"nesco":             "Mumbai",
	"bombay exhibition": "Mumbai",
	"bandra kurla":      "Mumbai",
	"bkc":               "Mumbai",
	"lalit mumbai":      "Mumbai",
	"lalit hotels":      "Mumbai", // "The Lalit Hotels, Palaces & Resorts" — Mumbai HQ
	"kohinoor":          "Mumbai",
	"holiday inn mumbai": "Mumbai",
	"andheri":           "Mumbai",
	"powai":             "Mumbai",
	"lower parel":       "Mumbai",
	"goregaon":          "Mumbai",
	"malad":             "Mumbai",
	"borivali":          "Mumbai",
	"worli":             "Mumbai",
	"dadar":             "Mumbai",
	"juhu":              "Mumbai",
	"kurla":             "Mumbai",
	"vikhroli":          "Mumbai",
	"kandivali":         "Mumbai",
	"chembur":           "Mumbai",
	"ghatkopar":         "Mumbai",
	"nsci dome":         "Mumbai",
	"devx andheri":      "Mumbai", // "DevX Andheri East"

	// ── Hyderabad ──────────────────────────────────────────────────────
	"hitex":                          "Hyderabad",
	"university of hyderabad":        "Hyderabad",
	"iit hyderabad":                  "Hyderabad",
	"ameerpet":                       "Hyderabad",
	"banjara hills":                  "Hyderabad",
	"jubilee hills":                  "Hyderabad",
	"kondapur":                       "Hyderabad",
	"gachibowli":                     "Hyderabad",
	"hitech city":                    "Hyderabad",
	"hitec city":                     "Hyderabad",
	"madhapur":                       "Hyderabad",
	"miyapur":                        "Hyderabad",
	"kukatpally":                     "Hyderabad",
	"begumpet":                       "Hyderabad",
	"manikonda":                      "Hyderabad",
	"nanakramguda":                   "Hyderabad",
	"durgam cheruvu":                 "Hyderabad", // "CoKarma Durgam Cheruvu"
	"financial district":             "Hyderabad", // "CoKarma Financial District"
	"cokarma":                        "Hyderabad",
	"t-hub":                          "Hyderabad",
	"t hub":                          "Hyderabad",
	"hyderabad international":        "Hyderabad",
	"hicc":                           "Hyderabad",
	"novotel hyderabad":              "Hyderabad",
	"version it":                     "Hyderabad",

	// ── Chennai ────────────────────────────────────────────────────────
	"chennai trade centre": "Chennai",
	"sathyabama":           "Chennai",
	"velammal":             "Chennai",
	"itc grand chola":      "Chennai",
	"st joseph's college":  "Chennai",
	"guindy":               "Chennai",
	"tharamani":            "Chennai",
	"nandambakkam":         "Chennai",
	"t nagar":              "Chennai",
	"anna nagar":           "Chennai",
	"velachery":            "Chennai",
	"adyar":                "Chennai",
	"nungambakkam":         "Chennai",
	"sholinganallur":       "Chennai",
	"perungudi":            "Chennai",
	"tidel park":           "Chennai",

	// ── Pune ───────────────────────────────────────────────────────────
	"novotel pune":   "Pune",
	"baner":          "Pune",
	"sahaj software": "Pune",
	"mauji":          "Pune",
	"koregaon park":  "Pune",
	"viman nagar":    "Pune",
	"hinjewadi":      "Pune",
	"wakad":          "Pune",
	"kothrud":        "Pune",
	"aundh":          "Pune",
	"hadapsar":       "Pune",
	"kharadi":        "Pune",
	"magarpatta":     "Pune",
	"shivajinagar":   "Pune",
	"ideas to impacts": "Pune",

	// ── New Delhi ──────────────────────────────────────────────────────
	"bharat mandapam":  "New Delhi",
	"pragati maidan":   "New Delhi",
	"yashobhoomi":      "New Delhi",
	"sunder nursery":   "New Delhi",
	"hauz khas":        "New Delhi",
	"connaught place":  "New Delhi",
	"aerocity":         "New Delhi",
	"pullman new delhi": "New Delhi",
	"nehru place":      "New Delhi",
	"karol bagh":       "New Delhi",
	"vasant kunj":      "New Delhi",
	"dwarka":           "New Delhi",
	"rohini":           "New Delhi",
	"saket":            "New Delhi",
	"india expo mart":  "New Delhi",

	// ── Gurugram ───────────────────────────────────────────────────────
	"sector 44":        "Gurugram",
	"sector 49":        "Gurugram",
	"sector 60":        "Gurugram",
	"cyber hub":        "Gurugram",
	"cyberhub":         "Gurugram",
	"cyber city":       "Gurugram",
	"dlf cyber":        "Gurugram",
	"sohna road":       "Gurugram",
	"golf course road": "Gurugram",

	// ── Noida ──────────────────────────────────────────────────────────
	"india expo centre": "Noida",
	"greater noida":     "Noida",

	// ── Kolkata ────────────────────────────────────────────────────────
	"biswa bangla": "Kolkata",
	"itc sonar":    "Kolkata",
	"salt lake":    "Kolkata",
	"new town":     "Kolkata",
	"rajarhat":     "Kolkata",
	"park street":  "Kolkata",
	"sector v":     "Kolkata",

	// ── Ahmedabad ──────────────────────────────────────────────────────
	"gmdc":                                   "Ahmedabad",
	"gulmohar greens":                        "Ahmedabad",
	"gujarat university":                     "Ahmedabad",
	"entrepreneurship development institute": "Ahmedabad",
	"eka club":                               "Ahmedabad",
	"sunnyville":                             "Ahmedabad",
	"vigyan bhawan science city":             "Ahmedabad",
	"ihub gujarat":                           "Ahmedabad", // "iHub Gujarat"
	"sg highway":                             "Ahmedabad",
	"cg road":                                "Ahmedabad",
	"navrangpura":                            "Ahmedabad",
	"prahlad nagar":                          "Ahmedabad",
	"bodakdev":                               "Ahmedabad",

	// ── Rajkot ─────────────────────────────────────────────────────────
	"devx rajkot": "Rajkot", // "DevX Rajkot"

	// ── Vadodara ───────────────────────────────────────────────────────
	"devx vadodara":       "Vadodara", // "DevX Vadodara"
	"devx sindhu bhavan":  "Vadodara", // "DevX Sindhu Bhavan Road" (Ahmedabad/Vadodara area)

	// ── Jaipur ─────────────────────────────────────────────────────────
	"jaipur exhibition": "Jaipur",
	"jecc":              "Jaipur",
	"malviya nagar":     "Jaipur",
	"vaishali nagar":    "Jaipur",
	"sitapura":          "Jaipur",

	// ── Salem ──────────────────────────────────────────────────────────
	"j startup house": "Salem", // "J Startup House" — known Salem coworking

	// ── Online ─────────────────────────────────────────────────────────
	"zoom":    "Online",
	"webinar": "Online",
	"meet.google": "Online",
	"teams.microsoft": "Online",
}

// normalizeText lowercases, trims, and collapses whitespace.
func normalizeText(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	prevSpace := false
	for _, r := range s {
		if unicode.IsSpace(r) || r == '\t' || r == '\n' {
			if !prevSpace {
				b.WriteRune(' ')
			}
			prevSpace = true
		} else {
			b.WriteRune(r)
			prevSpace = false
		}
	}
	return strings.TrimSpace(b.String())
}

// isGarbageLocation returns true for strings that are clearly not real locations.
// These should not even be attempted for city extraction.
func isGarbageLocation(s string) bool {
	lower := strings.ToLower(strings.TrimSpace(s))
	garbagePatterns := []string{
		"http://", "https://", "register at:", "venue will be shared",
		"tba", "to be announced", "to be confirmed", "details coming",
		"hall -", "hall-", // "Hall - 11" — no city info
	}
	for _, p := range garbagePatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	// Pure numeric or very short strings
	if len(strings.TrimSpace(s)) < 4 {
		return true
	}
	return false
}

// ExtractCity derives a canonical city name from a raw location string.
// Returns "Unknown" if no city can be confidently determined.
//
// Strategy (in order):
//  1. Garbage / unresolvable → "Unknown"
//  2. Venue/landmark dictionary match (substring scan)
//  3. City alias/token match (comma-split + word-boundary scan)
//  4. Unknown
func ExtractCity(rawLocation string) string {
	if strings.TrimSpace(rawLocation) == "" {
		return "Unknown"
	}

	if isGarbageLocation(rawLocation) {
		return "Unknown"
	}

	norm := normalizeText(rawLocation)

	// ── Step 1: venue substring match ────────────────────────────────────
	// Sort by length descending implicitly by trying longer keys first is not
	// easy in Go maps, so we just scan all — correctness over micro-perf here.
	bestVenue := ""
	bestCity := ""
	for venue, city := range venueToCity {
		if strings.Contains(norm, venue) {
			// Prefer longer (more specific) venue key match
			if len(venue) > len(bestVenue) {
				bestVenue = venue
				bestCity = city
			}
		}
	}
	if bestCity != "" {
		return bestCity
	}

	// ── Step 2: city alias token match ───────────────────────────────────
	parts := strings.Split(norm, ",")
	parts = append(parts, norm) // also try full string

	for _, part := range parts {
		part = strings.TrimSpace(part)
		// Direct match
		if city, ok := cityAliases[part]; ok {
			return city
		}
		// Word-token match
		words := strings.Fields(part)
		for i, w := range words {
			if city, ok := cityAliases[w]; ok {
				return city
			}
			// Two-word phrase (e.g. "new delhi", "navi mumbai")
			if i+1 < len(words) {
				twoWord := w + " " + words[i+1]
				if city, ok := cityAliases[twoWord]; ok {
					return city
				}
			}
		}
	}

	return "Unknown"
}