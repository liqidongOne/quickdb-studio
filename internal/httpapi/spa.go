package httpapi

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/liqidongOne/quickdb-studio/internal/webassets"
)

// mountSPA mounts the embedded WebUI SPA.
//
// Behavior:
// - /assets/*: serve static files from embedded dist (Vite output).
// - Any other non-API path: fallback to index.html (SPA client-side routing).
//
// It MUST NOT intercept /api/v1 routes.
func mountSPA(router chi.Router) {
	// Serve /assets/* directly from embedded FS.
	assetServer := http.FileServer(http.FS(webassets.DistFS))
	router.Get("/assets/*", func(w http.ResponseWriter, r *http.Request) {
		assetServer.ServeHTTP(w, r)
	})

	// Fallback all other (non-API) paths to index.html.
	router.NotFound(func(w http.ResponseWriter, r *http.Request) {
		// Keep API 404 semantics.
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		// Only GET/HEAD should be handled by SPA fallback.
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}

		indexHTML, err := fs.ReadFile(webassets.DistFS, "index.html")
		if err != nil {
			http.Error(w, "webui index.html is missing (did you copy webui/dist?)", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		if r.Method == http.MethodHead {
			return
		}
		_, _ = w.Write(indexHTML)
	})
}
