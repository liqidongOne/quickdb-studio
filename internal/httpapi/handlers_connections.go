package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/liqidongOne/quickdb-studio/internal/model"
	"github.com/liqidongOne/quickdb-studio/internal/util"
)

func (r *Router) handleGetConnections(w http.ResponseWriter, req *http.Request) {
	if r.store == nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "store_not_initialized"})
		return
	}

	conns, err := r.store.LoadConnections()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "storage_error", Details: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, conns)
}

type createConnectionReq struct {
	Name  string          `json:"name"`
	Type  model.ConnType  `json:"type"`
	MySQL *model.MySQLConfig `json:"mysql,omitempty"`
	Redis *model.RedisConfig `json:"redis,omitempty"`
}

type updateConnectionReq struct {
	Name  *string            `json:"name,omitempty"`
	Type  *model.ConnType    `json:"type,omitempty"`
	MySQL *model.MySQLConfig `json:"mysql,omitempty"`
	Redis *model.RedisConfig `json:"redis,omitempty"`
}

func (r *Router) handleCreateConnection(w http.ResponseWriter, req *http.Request) {
	if r.store == nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "store_not_initialized"})
		return
	}

	var body createConnectionReq
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: err.Error()})
		return
	}

	id, err := util.NewID()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "internal_error", Details: err.Error()})
		return
	}

	now := time.Now().UnixMilli()
	conn := model.Connection{
		ID:        id,
		Name:      body.Name,
		Type:      body.Type,
		MySQL:     body.MySQL,
		Redis:     body.Redis,
		CreatedAt: now,
		UpdatedAt: now,
	}

	conns, err := r.store.LoadConnections()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "storage_error", Details: err.Error()})
		return
	}
	conns = append(conns, conn)
	if err := r.store.SaveConnections(conns); err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "storage_error", Details: err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, conn)
}

func (r *Router) handleUpdateConnection(w http.ResponseWriter, req *http.Request) {
	if r.store == nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "store_not_initialized"})
		return
	}

	id := chi.URLParam(req, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing id"})
		return
	}

	var body updateConnectionReq
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: err.Error()})
		return
	}

	conns, err := r.store.LoadConnections()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "storage_error", Details: err.Error()})
		return
	}

	for i := range conns {
		if conns[i].ID != id {
			continue
		}
		old := conns[i]
		if body.Name != nil {
			conns[i].Name = *body.Name
		}
		if body.Type != nil {
			conns[i].Type = *body.Type
		}
		// 允许整体覆盖（MVP）
		if body.MySQL != nil || body.Redis != nil {
			// 密码留空=不修改：避免前端编辑时未填密码导致被清空
			if body.MySQL != nil && body.MySQL.Password == "" && old.MySQL != nil {
				body.MySQL.Password = old.MySQL.Password
			}
			if body.Redis != nil && body.Redis.Password == "" && old.Redis != nil {
				body.Redis.Password = old.Redis.Password
			}
			conns[i].MySQL = body.MySQL
			conns[i].Redis = body.Redis
		}
		conns[i].UpdatedAt = time.Now().UnixMilli()

		if err := r.store.SaveConnections(conns); err != nil {
			writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "storage_error", Details: err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, conns[i])
		return
	}

	writeJSON(w, http.StatusNotFound, model.ErrorResp{Error: "not_found"})
}

func (r *Router) handleDeleteConnection(w http.ResponseWriter, req *http.Request) {
	if r.store == nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "store_not_initialized"})
		return
	}

	id := chi.URLParam(req, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing id"})
		return
	}

	conns, err := r.store.LoadConnections()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "storage_error", Details: err.Error()})
		return
	}

	out := conns[:0]
	found := false
	for i := range conns {
		if conns[i].ID == id {
			found = true
			continue
		}
		out = append(out, conns[i])
	}
	if !found {
		writeJSON(w, http.StatusNotFound, model.ErrorResp{Error: "not_found"})
		return
	}
	if err := r.store.SaveConnections(out); err != nil {
		writeJSON(w, http.StatusInternalServerError, model.ErrorResp{Error: "storage_error", Details: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, model.OkResp{Ok: true})
}
