package httpapi

import (
	"encoding/json"
	"net/http"
)

// writeJSON writes v as JSON with the given status code.
//
// Note: encoding errors are intentionally ignored because headers/body might
// already be written (and callers currently don't handle encode failures).
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(v)
}

