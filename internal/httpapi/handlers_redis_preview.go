package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"

	"github.com/liqidongOne/quickdb-studio/internal/model"
	"github.com/liqidongOne/quickdb-studio/internal/redix"
)

// Task 3 - Redis preview endpoints.

type redisKeysSearchReq struct {
	Pattern string `json:"pattern"`
	Cursor  string `json:"cursor"`
	Count   int64  `json:"count"`
}

type redisKeysSearchResp struct {
	Keys       []string `json:"keys"`
	NextCursor string   `json:"nextCursor"`
}

func (r *Router) handleRedisKeysSearch(w http.ResponseWriter, req *http.Request) {
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

	var body redisKeysSearchReq
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: err.Error()})
		return
	}
	if body.Count <= 0 {
		body.Count = 200
	}

	cur := uint64(0)
	if body.Cursor != "" {
		u, err := strconv.ParseUint(body.Cursor, 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "invalid cursor"})
			return
		}
		cur = u
	}

	c, err := redix.Open(*conn.Redis)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_unreachable", Details: err.Error()})
		return
	}
	defer c.Close()

	ctx, cancel := context.WithTimeout(req.Context(), redisReqTimeout)
	defer cancel()

	keys, next, err := redix.ScanKeys(ctx, c, body.Pattern, cur, body.Count)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, redisKeysSearchResp{Keys: keys, NextCursor: strconv.FormatUint(next, 10)})
}

func (r *Router) handleRedisKeyPreview(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")
	key := req.URL.Query().Get("key")
	if key == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing key"})
		return
	}

	// Optional params (used depending on key type).
	var (
		cur   uint64
		count int64
		start int64
		stop  int64
	)

	if cursorStr := req.URL.Query().Get("cursor"); cursorStr != "" {
		u, err := strconv.ParseUint(cursorStr, 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "invalid cursor"})
			return
		}
		cur = u
	}
	if countStr := req.URL.Query().Get("count"); countStr != "" {
		v, err := strconv.ParseInt(countStr, 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "invalid count"})
			return
		}
		count = v
	}
	if count <= 0 {
		count = 200
	}

	// Defaults for list range (if needed).
	start = 0
	stop = 99
	if startStr := req.URL.Query().Get("start"); startStr != "" {
		v, err := strconv.ParseInt(startStr, 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "invalid start"})
			return
		}
		start = v
	}
	if stopStr := req.URL.Query().Get("stop"); stopStr != "" {
		v, err := strconv.ParseInt(stopStr, 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "invalid stop"})
			return
		}
		stop = v
	}

	conn, err := loadConn(r.store, connID, model.ConnTypeRedis)
	if err != nil {
		r.writeConnLoadErr(w, err)
		return
	}
	if conn.Redis == nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing redis config"})
		return
	}

	c, err := redix.Open(*conn.Redis)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_unreachable", Details: err.Error()})
		return
	}
	defer c.Close()

	ctx, cancel := context.WithTimeout(req.Context(), redisReqTimeout)
	defer cancel()

	typ, ttlMs, err := redix.KeyMeta(ctx, c, key)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
		return
	}
	if typ == "none" {
		writeJSON(w, http.StatusNotFound, model.ErrorResp{Error: "not_found"})
		return
	}

	out := model.RedisKeyPreviewResp{
		Key:   key,
		Type:  typ,
		TTLMs: ttlMs,
	}

	switch typ {
	case "string":
		val, trunc, err := redix.GetString(ctx, c, key, redisStringMaxBytes)
		if err != nil {
			if errors.Is(err, redis.Nil) {
				writeJSON(w, http.StatusNotFound, model.ErrorResp{Error: "not_found"})
				return
			}
			writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
			return
		}
		out.Data = model.RedisStringData{Value: val, Truncated: trunc}
	case "hash":
		items, next, err := redix.HScan(ctx, c, key, cur, count)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
			return
		}
		converted := make([]model.RedisHashEntry, 0, len(items))
		for _, it := range items {
			converted = append(converted, model.RedisHashEntry{Field: it.Field, Value: it.Value})
		}
		out.Data = model.RedisHashData{Items: converted, NextCursor: strconv.FormatUint(next, 10)}
	case "set":
		members, next, err := redix.SScan(ctx, c, key, cur, count)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
			return
		}
		out.Data = model.RedisSetData{Members: members, NextCursor: strconv.FormatUint(next, 10)}
	case "zset":
		items, next, err := redix.ZScan(ctx, c, key, cur, count)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
			return
		}
		converted := make([]model.RedisZSetEntry, 0, len(items))
		for _, it := range items {
			converted = append(converted, model.RedisZSetEntry{Member: it.Member, Score: it.Score})
		}
		out.Data = model.RedisZSetData{Items: converted, NextCursor: strconv.FormatUint(next, 10)}
	case "list":
		items, err := redix.LRange(ctx, c, key, start, stop)
		if err != nil {
			if errors.Is(err, redis.Nil) {
				writeJSON(w, http.StatusNotFound, model.ErrorResp{Error: "not_found"})
				return
			}
			writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
			return
		}
		out.Data = model.RedisListData{Start: start, Stop: stop, Items: items}
	default:
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "unsupported redis type"})
		return
	}

	writeJSON(w, http.StatusOK, out)
}
