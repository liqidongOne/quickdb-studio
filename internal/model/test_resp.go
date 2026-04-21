package model

// TestConnResp is a generic "test connection" response for MySQL/Redis.
type TestConnResp struct {
	Ok        bool  `json:"ok"`
	LatencyMs int64 `json:"latencyMs"`
}

