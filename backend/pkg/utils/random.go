package utils

import (
	"math/rand"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// RandomInt returns a random integer in [0, n)
func RandomInt(n int) int {
	if n <= 0 {
		return 0
	}
	return rand.Intn(n)
}
