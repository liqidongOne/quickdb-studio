package model

// RedisKeyPreviewResp is the unified key preview response for Redis keys.
//
// Spec fields:
// - key/type/ttlMs/data
// - data shape depends on "type"
type RedisKeyPreviewResp struct {
	Key   string `json:"key"`
	Type  string `json:"type"`
	TTLMs int64  `json:"ttlMs"`
	Data  any    `json:"data,omitempty"`
}

type RedisStringData struct {
	Value     string `json:"value"`
	Truncated bool   `json:"truncated"`
}

type RedisHashEntry struct {
	Field string `json:"field"`
	Value string `json:"value"`
}

type RedisHashData struct {
	Items      []RedisHashEntry `json:"items"`
	NextCursor string           `json:"nextCursor"`
}

type RedisSetData struct {
	Members    []string `json:"members"`
	NextCursor string   `json:"nextCursor"`
}

type RedisZSetEntry struct {
	Member string  `json:"member"`
	Score  float64 `json:"score"`
}

type RedisZSetData struct {
	Items      []RedisZSetEntry `json:"items"`
	NextCursor string           `json:"nextCursor"`
}

type RedisListData struct {
	Start int64    `json:"start"`
	Stop  int64    `json:"stop"`
	Items []string `json:"items"`
}

