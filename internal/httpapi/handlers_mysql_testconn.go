package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/liqidongOne/quickdb-studio/internal/model"
	"github.com/liqidongOne/quickdb-studio/internal/mysqlx"
)

func (r *Router) handleMySQLTest(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")

	conn, err := loadConn(r.store, connID, model.ConnTypeMySQL)
	if err != nil {
		r.writeConnLoadErr(w, err)
		return
	}
	if conn.MySQL == nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing mysql config"})
		return
	}

	start := time.Now()
	db, err := mysqlx.Open(*conn.MySQL)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_open_error", Details: err.Error()})
		return
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_unreachable", Details: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, model.TestConnResp{
		Ok:        true,
		LatencyMs: time.Since(start).Milliseconds(),
	})
}
