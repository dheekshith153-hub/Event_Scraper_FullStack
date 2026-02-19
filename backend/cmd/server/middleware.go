package main

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const userIDKey contextKey = "userID"

// requireAuth middleware - protects endpoints that need authentication
func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			jsonError(w, "Unauthorized - No token provided", 401)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := parseJWT(tokenStr)
		if err != nil {
			jsonError(w, "Invalid or expired token", 401)
			return
		}

		userID, ok := claims["user_id"].(string)
		if !ok || userID == "" {
			jsonError(w, "Invalid token claims", 401)
			return
		}

		// Add userID to request context
		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next(w, r.WithContext(ctx))
	}
}

// getUserID extracts user ID from request context
func getUserID(r *http.Request) string {
	userID, _ := r.Context().Value(userIDKey).(string)
	return userID
}

// optionalAuth - allows both authenticated and anonymous access
func (s *Server) optionalAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := parseJWT(tokenStr)
			if err == nil {
				if userID, ok := claims["user_id"].(string); ok && userID != "" {
					ctx := context.WithValue(r.Context(), userIDKey, userID)
					r = r.WithContext(ctx)
				}
			}
		}
		next(w, r)
	}
}