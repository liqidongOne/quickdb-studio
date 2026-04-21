package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/liqidongOne/quickdb-studio/internal/model"
	"github.com/liqidongOne/quickdb-studio/internal/mysqlx"
	"github.com/liqidongOne/quickdb-studio/internal/sqlguard"
)

const mysqlReqTimeout = 10 * time.Second

const (
	mysqlQueryTimeout     = 30 * time.Second
	mysqlQueryMaxRows     = 5000
	mysqlQueryMaxCellBytes = 64 * 1024
	mysqlQueryMaxWarnings = 20
)

func (r *Router) handleMySQLDatabases(w http.ResponseWriter, req *http.Request) {
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

	db, err := mysqlx.Open(*conn.MySQL)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "mysql_open_error", Details: err.Error()})
		return
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(req.Context(), mysqlReqTimeout)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_unreachable", Details: err.Error()})
		return
	}

	out, err := mysqlx.ListDatabases(ctx, db)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_query_error", Details: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (r *Router) handleMySQLTables(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")
	dbName := req.URL.Query().Get("db")
	if dbName == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing db"})
		return
	}

	conn, err := loadConn(r.store, connID, model.ConnTypeMySQL)
	if err != nil {
		r.writeConnLoadErr(w, err)
		return
	}
	if conn.MySQL == nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing mysql config"})
		return
	}

	db, err := mysqlx.Open(*conn.MySQL)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "mysql_open_error", Details: err.Error()})
		return
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(req.Context(), mysqlReqTimeout)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_unreachable", Details: err.Error()})
		return
	}

	out, err := mysqlx.ListTables(ctx, db, dbName)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_query_error", Details: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type mysqlTableResp struct {
	Database string              `json:"database"`
	Table    string              `json:"table"`
	Columns  []mysqlx.TableColumn `json:"columns"`
	Indexes  []mysqlx.TableIndex  `json:"indexes"`
}

func (r *Router) handleMySQLTable(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")
	dbName := req.URL.Query().Get("db")
	tableName := req.URL.Query().Get("table")
	if dbName == "" || tableName == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing db or table"})
		return
	}

	conn, err := loadConn(r.store, connID, model.ConnTypeMySQL)
	if err != nil {
		r.writeConnLoadErr(w, err)
		return
	}
	if conn.MySQL == nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing mysql config"})
		return
	}

	db, err := mysqlx.Open(*conn.MySQL)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "mysql_open_error", Details: err.Error()})
		return
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(req.Context(), mysqlReqTimeout)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_unreachable", Details: err.Error()})
		return
	}

	cols, err := mysqlx.GetTableColumns(ctx, db, dbName, tableName)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_query_error", Details: err.Error()})
		return
	}
	idxs, err := mysqlx.GetTableIndexes(ctx, db, dbName, tableName)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_query_error", Details: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, mysqlTableResp{
		Database: dbName,
		Table:    tableName,
		Columns:  cols,
		Indexes:  idxs,
	})
}

type mysqlQueryReq struct {
	SQL string `json:"sql"`
	DB  string `json:"db,omitempty"`
}

type mysqlQueryResp struct {
	Columns   []string `json:"columns"`
	Rows      [][]any  `json:"rows"`
	Truncated bool     `json:"truncated"`
	Warnings  []string `json:"warnings,omitempty"`
	ElapsedMs int64    `json:"elapsedMs"`
}

func (r *Router) handleMySQLQuery(w http.ResponseWriter, req *http.Request) {
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

	var body mysqlQueryReq
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: err.Error()})
		return
	}
	body.SQL = strings.TrimSpace(body.SQL)
	if body.SQL == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing sql"})
		return
	}

	if err := sqlguard.ValidateMySQLReadonly(body.SQL); err != nil {
		switch {
		case errors.Is(err, sqlguard.ErrMultiStmt):
			writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "multi statements are not allowed"})
		case errors.Is(err, sqlguard.ErrNotReadonly):
			writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "sql is not readonly"})
		default:
			writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: err.Error()})
		}
		return
	}

	cfg := *conn.MySQL
	if body.DB != "" {
		cfg.DefaultDatabase = body.DB
	}

	db, err := mysqlx.Open(cfg)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "mysql_open_error", Details: err.Error()})
		return
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(req.Context(), mysqlQueryTimeout)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_unreachable", Details: err.Error()})
		return
	}

	start := time.Now()
	rows, err := db.QueryContext(ctx, body.SQL)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_query_error", Details: err.Error()})
		return
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_query_error", Details: err.Error()})
		return
	}

	out := mysqlQueryResp{
		Columns: cols,
	}

	warn := func(msg string) {
		if len(out.Warnings) >= mysqlQueryMaxWarnings {
			return
		}
		out.Warnings = append(out.Warnings, msg)
	}

	for rows.Next() {
		if len(out.Rows) >= mysqlQueryMaxRows {
			out.Truncated = true
			warn("result truncated: maxRows reached")
			break
		}

		values := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_query_error", Details: err.Error()})
			return
		}

		row := make([]any, len(cols))
		for i, v := range values {
			switch vv := v.(type) {
			case nil:
				row[i] = nil
			case []byte:
				if len(vv) > mysqlQueryMaxCellBytes {
					out.Truncated = true
					warn("cell truncated: maxCellBytes exceeded")
					vv = vv[:mysqlQueryMaxCellBytes]
				}
				row[i] = string(vv)
			case sql.RawBytes:
				b := []byte(vv)
				if len(b) > mysqlQueryMaxCellBytes {
					out.Truncated = true
					warn("cell truncated: maxCellBytes exceeded")
					b = b[:mysqlQueryMaxCellBytes]
				}
				row[i] = string(b)
			default:
				// Most driver types (int64/float64/bool/time.Time/string) marshal fine.
				row[i] = vv
			}
		}
		out.Rows = append(out.Rows, row)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "mysql_query_error", Details: err.Error()})
		return
	}

	out.ElapsedMs = time.Since(start).Milliseconds()
	writeJSON(w, http.StatusOK, out)
}

func (r *Router) writeConnLoadErr(w http.ResponseWriter, err error) {
	var ce *ConnLoadError
	if !errors.As(err, &ce) {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "internal_error", Details: err.Error()})
		return
	}

	switch ce.Code {
	case "bad_request":
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: ce.Error()})
	case "not_found":
		writeJSON(w, http.StatusNotFound, model.ErrorResp{Error: "not_found"})
	case "type_mismatch":
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "connection type mismatch"})
	case "storage_error":
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "storage_error", Details: ce.Err.Error()})
	case "store_not_initialized":
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "store_not_initialized"})
	default:
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "internal_error", Details: ce.Error()})
	}
}
