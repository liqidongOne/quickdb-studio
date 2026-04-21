package httpapi

import (
	"net/http"

	"github.com/liqidongOne/quickdb-studio/internal/model"
)

func (r *Router) handleNavTree(w http.ResponseWriter, req *http.Request) {
	if r.store == nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "store_not_initialized"})
		return
	}

	conns, err := r.store.LoadConnections()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "storage_error", Details: err.Error()})
		return
	}

	out := model.NavTreeResp{}
	for _, c := range conns {
		n := model.NavConn{ID: c.ID, Name: c.Name, Type: c.Type}
		switch c.Type {
		case model.ConnTypeMySQL:
			out.MySQL = append(out.MySQL, n)
		case model.ConnTypeRedis:
			out.Redis = append(out.Redis, n)
		}
	}

	writeJSON(w, http.StatusOK, out)
}
