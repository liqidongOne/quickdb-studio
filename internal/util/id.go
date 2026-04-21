package util

import (
	"crypto/rand"
	"encoding/base64"
)

// NewID returns a random URL-safe ID (no padding).
//
// NOTE: 12 bytes -> 16 chars in base64url.
func NewID() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

