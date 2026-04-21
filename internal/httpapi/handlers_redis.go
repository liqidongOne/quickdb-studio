package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"

	"github.com/liqidongOne/quickdb-studio/internal/model"
	"github.com/liqidongOne/quickdb-studio/internal/redix"
)

const (
	redisReqTimeout     = 10 * time.Second
	redisStringMaxBytes = 64 * 1024
)

type redisScanReq struct {
	Pattern string `json:"pattern"`
	Cursor  string `json:"cursor"`
	Count   int64  `json:"count"`
}

type redisScanResp struct {
	Keys       []string `json:"keys"`
	NextCursor string   `json:"nextCursor"`
}

func (r *Router) handleRedisScan(w http.ResponseWriter, req *http.Request) {
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

	var body redisScanReq
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: err.Error()})
		return
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
	writeJSON(w, http.StatusOK, redisScanResp{Keys: keys, NextCursor: strconv.FormatUint(next, 10)})
}

type redisKeyMetaResp struct {
	Key  string `json:"key"`
	Type string `json:"type"`
	PTTL int64  `json:"pttl"` // ms
}

func (r *Router) handleRedisKeyMeta(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")
	key := req.URL.Query().Get("key")
	if key == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing key"})
		return
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

	typ, pttlMs, err := redix.KeyMeta(ctx, c, key)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
		return
	}
	if typ == "none" {
		writeJSON(w, http.StatusNotFound, model.ErrorResp{Error: "not_found"})
		return
	}

	writeJSON(w, http.StatusOK, redisKeyMetaResp{Key: key, Type: typ, PTTL: pttlMs})
}

type redisKeyStringResp struct {
	Key       string `json:"key"`
	Value     string `json:"value"`
	Truncated bool   `json:"truncated"`
}

func (r *Router) handleRedisKeyString(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")
	key := req.URL.Query().Get("key")
	if key == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing key"})
		return
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

	val, trunc, err := redix.GetString(ctx, c, key, redisStringMaxBytes)
	if err != nil {
		if errors.Is(err, redis.Nil) {
			writeJSON(w, http.StatusNotFound, model.ErrorResp{Error: "not_found"})
			return
		}
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, redisKeyStringResp{Key: key, Value: val, Truncated: trunc})
}

type redisKeyScanReq struct {
	Key    string `json:"key"`
	Cursor string `json:"cursor"`
	Count  int64  `json:"count"`
}

type redisHashScanResp struct {
	Key    string           `json:"key"`
	Items  []redix.HashEntry `json:"items"`
	NextCursor string       `json:"nextCursor"`
}

func (r *Router) handleRedisHashScan(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")

	var body redisKeyScanReq
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: err.Error()})
		return
	}
	if body.Key == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing key"})
		return
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

	items, next, err := redix.HScan(ctx, c, body.Key, cur, body.Count)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, redisHashScanResp{Key: body.Key, Items: items, NextCursor: strconv.FormatUint(next, 10)})
}

type redisListRangeResp struct {
	Key   string   `json:"key"`
	Start int64    `json:"start"`
	Stop  int64    `json:"stop"`
	Items []string `json:"items"`
}

func (r *Router) handleRedisListRange(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")
	key := req.URL.Query().Get("key")
	if key == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing key"})
		return
	}

	startStr := req.URL.Query().Get("start")
	stopStr := req.URL.Query().Get("stop")
	if startStr == "" || stopStr == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing start or stop"})
		return
	}
	start, err := strconv.ParseInt(startStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "invalid start"})
		return
	}
	stop, err := strconv.ParseInt(stopStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "invalid stop"})
		return
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

	items, err := redix.LRange(ctx, c, key, start, stop)
	if err != nil {
		if errors.Is(err, redis.Nil) {
			writeJSON(w, http.StatusNotFound, model.ErrorResp{Error: "not_found"})
			return
		}
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, redisListRangeResp{
		Key:   key,
		Start: start,
		Stop: stop,
		Items: items,
	})
}

type redisSetScanResp struct {
	Key        string   `json:"key"`
	Members    []string `json:"members"`
	NextCursor string   `json:"nextCursor"`
}

func (r *Router) handleRedisSetScan(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")

	var body redisKeyScanReq
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: err.Error()})
		return
	}
	if body.Key == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing key"})
		return
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

	members, next, err := redix.SScan(ctx, c, body.Key, cur, body.Count)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, redisSetScanResp{Key: body.Key, Members: members, NextCursor: strconv.FormatUint(next, 10)})
}

type redisZSetScanResp struct {
	Key    string            `json:"key"`
	Items  []redix.ZSetEntry `json:"items"`
	NextCursor string        `json:"nextCursor"`
}

func (r *Router) handleRedisZSetScan(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")

	var body redisKeyScanReq
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: err.Error()})
		return
	}
	if body.Key == "" {
		writeJSON(w, http.StatusBadRequest, model.ErrorResp{Error: "bad_request", Details: "missing key"})
		return
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

	items, next, err := redix.ZScan(ctx, c, body.Key, cur, body.Count)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, model.ErrorResp{Error: "redis_command_error", Details: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, redisZSetScanResp{Key: body.Key, Items: items, NextCursor: strconv.FormatUint(next, 10)})
}
