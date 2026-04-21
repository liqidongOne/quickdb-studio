package security

import (
	"crypto/rand"
	"encoding/base64"
)

// NewToken32 returns a URL-safe token (~43 chars).
func NewToken32() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
