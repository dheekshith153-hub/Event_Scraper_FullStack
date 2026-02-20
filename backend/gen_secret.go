package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
)

func main() {
	secret := make([]byte, 32)
	_, err := rand.Read(secret)
	if err != nil {
		log.Fatal(err)
	}

	encodedSecret := base64.StdEncoding.EncodeToString(secret)
	fmt.Println("Generated Secure JWT Secret:")
	fmt.Println(encodedSecret)
	fmt.Println("\nYou can use this in your .env file as JWT_SECRET.")
}
