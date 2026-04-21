package httpapi

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/liqidongOne/quickdb-studio/internal/model"
	"github.com/liqidongOne/quickdb-studio/internal/mysqlx"
)

func (r *Router) handleMySQLTableMeta(w http.ResponseWriter, req *http.Request) {
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

	outCols := make([]model.MySQLTableColumn, 0, len(cols))
	for _, c := range cols {
		outCols = append(outCols, model.MySQLTableColumn{
			Name:            c.Name,
			DataType:        c.DataType,
			ColumnType:      c.ColumnType,
			IsNullable:      c.IsNullable,
			DefaultValue:    c.DefaultValue,
			Extra:           c.Extra,
			ColumnKey:       c.ColumnKey,
			OrdinalPosition: c.OrdinalPosition,
			Comment:         c.Comment,
		})
	}

	outIdxs := make([]model.MySQLTableIndex, 0, len(idxs))
	for _, i := range idxs {
		outIdxs = append(outIdxs, model.MySQLTableIndex{
			Name:       i.Name,
			NonUnique:  i.NonUnique,
			SeqInIndex: i.SeqInIndex,
			ColumnName: i.ColumnName,
			Collation:  i.Collation,
			Nullable:   i.Nullable,
			IndexType:  i.IndexType,
			Comment:    i.Comment,
		})
	}

	writeJSON(w, http.StatusOK, model.MySQLTableMetaResp{
		Database: dbName,
		Table:    tableName,
		Columns:  outCols,
		Indexes:  outIdxs,
	})
}
