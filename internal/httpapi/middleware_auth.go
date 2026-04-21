package httpapi

import (
	"net/http"

	"github.com/liqidongOne/quickdb-studio/internal/model"
)

func authMiddleware(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Header.Get("Authorization") != "Bearer "+token {
			writeJSON(w, http.StatusUnauthorized, model.ErrorResp{Error: "unauthorized"})
			return
		}
		next.ServeHTTP(w, req)
	})
}
