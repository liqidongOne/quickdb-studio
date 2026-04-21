package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/liqidongOne/quickdb-studio/internal/model"
	"github.com/liqidongOne/quickdb-studio/internal/storage"
)

type Router struct {
	token string
	mux   *chi.Mux
	store *storage.Store
}

// NewRouter creates the minimal API router.
//
// Endpoints:
// - GET /api/v1/health: no auth
// - GET /api/v1/secure/ping: bearer auth
func NewRouter(token string) http.Handler {
	store, err := storage.NewStore()
	if err != nil {
		panic(err)
	}
	r := &Router{
		token: token,
		mux:   chi.NewRouter(),
		store: store,
	}
	r.routes()
	return r.mux
}

func (r *Router) routes() {
	r.mux.Route("/api/v1", func(api chi.Router) {
		// Public endpoint (no auth).
		api.Get("/health", func(w http.ResponseWriter, req *http.Request) {
			writeJSON(w, http.StatusOK, model.OkResp{Ok: true})
		})

		// All other /api/v1 endpoints are protected by bearer auth.
		api.Group(func(secure chi.Router) {
			// chi middleware adaptor based on existing authMiddleware(token,next).
			secure.Use(func(next http.Handler) http.Handler {
				return authMiddleware(r.token, next)
			})

			secure.Get("/secure/ping", func(w http.ResponseWriter, req *http.Request) {
				writeJSON(w, http.StatusOK, map[string]any{"pong": true})
			})

			// Navigation tree (Task 1).
			secure.Get("/nav/tree", r.handleNavTree)

			// Connections API (Task 3).
			secure.Get("/connections", r.handleGetConnections)
			secure.Post("/connections", r.handleCreateConnection)
			secure.Put("/connections/{id}", r.handleUpdateConnection)
			secure.Delete("/connections/{id}", r.handleDeleteConnection)

			// MySQL schema browsing (Task 5).
			secure.Route("/mysql/{connId}", func(mysql chi.Router) {
				mysql.Get("/databases", r.handleMySQLDatabases)
				mysql.Get("/tables", r.handleMySQLTables)
				mysql.Get("/table", r.handleMySQLTable)
				mysql.Get("/table/meta", r.handleMySQLTableMeta)
				mysql.Post("/test", r.handleMySQLTest)
				mysql.Post("/query", r.handleMySQLQuery)
			})

			// Redis readonly browsing (Task 7).
			secure.Route("/redis/{connId}", func(rd chi.Router) {
				// Task 3 - unified key search + preview.
				rd.Post("/keys/search", r.handleRedisKeysSearch)
				rd.Get("/key/preview", r.handleRedisKeyPreview)

				rd.Post("/test", r.handleRedisTest)
				rd.Post("/scan", r.handleRedisScan)
				rd.Get("/key/meta", r.handleRedisKeyMeta)
				rd.Get("/key/string", r.handleRedisKeyString)
				rd.Post("/key/hash/scan", r.handleRedisHashScan)
				rd.Get("/key/list/range", r.handleRedisListRange)
				rd.Post("/key/set/scan", r.handleRedisSetScan)
				rd.Post("/key/zset/scan", r.handleRedisZSetScan)
			})
		})
	})

	// Mount SPA AFTER /api/v1 routes so it won't intercept API endpoints.
	mountSPA(r.mux)
}
