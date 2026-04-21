package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/liqidongOne/quickdb-studio/internal/model"
	"github.com/liqidongOne/quickdb-studio/internal/redix"
)

func (r *Router) handleRedisTest(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")

	conn, err := loadConn(r.store, connID, model.ConnTypeRedis)
	if err != nil {
		r.writeConnLoadErr(w, err)
		return
	}
	if conn.Redis == nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing redis config"})
		return
	}

	start := time.Now()
	c, err := redix.Open(*conn.Redis)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_unreachable", Details: err.Error()})
		return
	}
	defer c.Close()

	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()
	if err := c.Ping(ctx).Err(); err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, model.TestConnResp{
		Ok:        true,
		LatencyMs: time.Since(start).Milliseconds(),
	})
}
