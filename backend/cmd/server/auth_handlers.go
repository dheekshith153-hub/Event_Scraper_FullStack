package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type signupReq struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type signinReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type jwtClaims struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func writeJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req signupReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}

	req.FullName = strings.TrimSpace(req.FullName)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.FullName == "" || req.Email == "" || len(req.Password) < 6 {
		writeJSON(w, 400, map[string]string{"error": "fullName, email, password(>=6) required"})
		return
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "password hashing failed"})
		return
	}
	passwordHash := string(hashBytes)

	var id string
	err = s.db.QueryRow(context.Background(),
		`INSERT INTO users (full_name, email, password_hash)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		req.FullName, req.Email, passwordHash,
	).Scan(&id)

	if err != nil {
		// usually duplicate email
		writeJSON(w, 409, map[string]string{"error": "email already exists"})
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		writeJSON(w, 500, map[string]string{"error": "JWT_SECRET not set"})
		return
	}

	tokenStr, err := createJWT(id, req.Email, secret)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "token creation failed"})
		return
	}

	writeJSON(w, 200, map[string]any{
		"token": tokenStr,
		"user": map[string]any{
			"id":        id,
			"full_name": req.FullName,
			"email":     req.Email,
		},
	})
}

func (s *Server) handleSignin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req signinReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		writeJSON(w, 400, map[string]string{"error": "email and password required"})
		return
	}

	var id, fullName, passwordHash string
	err := s.db.QueryRow(context.Background(),
		`SELECT id, full_name, password_hash FROM users WHERE email=$1`,
		req.Email,
	).Scan(&id, &fullName, &passwordHash)

	if err != nil {
		writeJSON(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeJSON(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		writeJSON(w, 500, map[string]string{"error": "JWT_SECRET not set"})
		return
	}

	tokenStr, err := createJWT(id, req.Email, secret)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "token creation failed"})
		return
	}

	writeJSON(w, 200, map[string]any{
		"token": tokenStr,
		"user": map[string]any{
			"id":        id,
			"full_name": fullName,
			"email":     req.Email,
		},
	})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		writeJSON(w, 401, map[string]string{"error": "missing token"})
		return
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		writeJSON(w, 500, map[string]string{"error": "JWT_SECRET not set"})
		return
	}

	claims, err := parseJWT(tokenStr, secret)
	if err != nil {
		writeJSON(w, 401, map[string]string{"error": "invalid token"})
		return
	}

	var fullName, email string
	err = s.db.QueryRow(context.Background(),
		`SELECT full_name, email FROM users WHERE id=$1`,
		claims.UserID,
	).Scan(&fullName, &email)
	if err != nil {
		writeJSON(w, 401, map[string]string{"error": "user not found"})
		return
	}

	writeJSON(w, 200, map[string]any{
		"id":        claims.UserID,
		"full_name": fullName,
		"email":     email,
	})
}

func createJWT(userID, email, secret string) (string, error) {
	claims := jwtClaims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			// no need for IssuedAt/ExpiresAt if you want simpler; but recommended:
			// ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func parseJWT(tokenStr, secret string) (*jwtClaims, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, func(token *jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := t.Claims.(*jwtClaims)
	if !ok || !t.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}