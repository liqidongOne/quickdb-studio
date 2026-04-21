package redix

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/redis/go-redis/v9"
)

const (
	DefaultScanCount = int64(200)
)

type HashEntry struct {
	Field string `json:"field"`
	Value string `json:"value"`
}

type ZSetEntry struct {
	Member string  `json:"member"`
	Score  float64 `json:"score"`
}

func ScanKeys(ctx context.Context, c *redis.Client, pattern string, cursor uint64, count int64) ([]string, uint64, error) {
	if c == nil {
		return nil, 0, fmt.Errorf("redis: nil client")
	}
	if pattern == "" {
		pattern = "*"
	}
	if count <= 0 {
		count = DefaultScanCount
	}
	return c.Scan(ctx, cursor, pattern, count).Result()
}

// KeyMeta returns key TYPE and PTTL (milliseconds).
//
// Note:
// - For non-existing key: TYPE returns "none", PTTL returns -2.
// - For no expire: PTTL returns -1.
func KeyMeta(ctx context.Context, c *redis.Client, key string) (typ string, pttlMs int64, err error) {
	if c == nil {
		return "", 0, fmt.Errorf("redis: nil client")
	}
	if key == "" {
		return "", 0, fmt.Errorf("redis: empty key")
	}

	pipe := c.Pipeline()
	typeCmd := pipe.Type(ctx, key)
	ttlCmd := pipe.PTTL(ctx, key)
	_, err = pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		return "", 0, err
	}
	typ = typeCmd.Val()
	pttlMs = ttlCmd.Val().Milliseconds()
	return typ, pttlMs, nil
}

func GetString(ctx context.Context, c *redis.Client, key string, maxBytes int) (val string, truncated bool, err error) {
	if c == nil {
		return "", false, fmt.Errorf("redis: nil client")
	}
	if key == "" {
		return "", false, fmt.Errorf("redis: empty key")
	}
	raw, err := c.Get(ctx, key).Result()
	if err != nil {
		return "", false, err
	}
	out, trunc := truncateString(raw, maxBytes)
	return out, trunc, nil
}

func HScan(ctx context.Context, c *redis.Client, key string, cursor uint64, count int64) ([]HashEntry, uint64, error) {
	if c == nil {
		return nil, 0, fmt.Errorf("redis: nil client")
	}
	if key == "" {
		return nil, 0, fmt.Errorf("redis: empty key")
	}
	if count <= 0 {
		count = DefaultScanCount
	}

	raw, next, err := c.HScan(ctx, key, cursor, "", count).Result()
	if err != nil {
		return nil, 0, err
	}
	if len(raw)%2 != 0 {
		return nil, 0, fmt.Errorf("redis: invalid hscan result length=%d", len(raw))
	}

	out := make([]HashEntry, 0, len(raw)/2)
	for i := 0; i < len(raw); i += 2 {
		out = append(out, HashEntry{Field: raw[i], Value: raw[i+1]})
	}
	return out, next, nil
}

func SScan(ctx context.Context, c *redis.Client, key string, cursor uint64, count int64) ([]string, uint64, error) {
	if c == nil {
		return nil, 0, fmt.Errorf("redis: nil client")
	}
	if key == "" {
		return nil, 0, fmt.Errorf("redis: empty key")
	}
	if count <= 0 {
		count = DefaultScanCount
	}

	members, next, err := c.SScan(ctx, key, cursor, "", count).Result()
	if err != nil {
		return nil, 0, err
	}
	return members, next, nil
}

func ZScan(ctx context.Context, c *redis.Client, key string, cursor uint64, count int64) ([]ZSetEntry, uint64, error) {
	if c == nil {
		return nil, 0, fmt.Errorf("redis: nil client")
	}
	if key == "" {
		return nil, 0, fmt.Errorf("redis: empty key")
	}
	if count <= 0 {
		count = DefaultScanCount
	}

	raw, next, err := c.ZScan(ctx, key, cursor, "", count).Result()
	if err != nil {
		return nil, 0, err
	}
	items, err := parseZScanPairs(raw)
	if err != nil {
		return nil, 0, err
	}
	return items, next, nil
}

func LRange(ctx context.Context, c *redis.Client, key string, start, stop int64) ([]string, error) {
	if c == nil {
		return nil, fmt.Errorf("redis: nil client")
	}
	if key == "" {
		return nil, fmt.Errorf("redis: empty key")
	}
	return c.LRange(ctx, key, start, stop).Result()
}

func truncateString(s string, maxBytes int) (out string, truncated bool) {
	if s == "" {
		return "", false
	}
	if maxBytes <= 0 {
		return "", true
	}
	b := []byte(s)
	if len(b) <= maxBytes {
		return s, false
	}
	return string(b[:maxBytes]), true
}

func parseZScanPairs(raw []string) ([]ZSetEntry, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	if len(raw)%2 != 0 {
		return nil, fmt.Errorf("redis: invalid zscan result length=%d", len(raw))
	}

	out := make([]ZSetEntry, 0, len(raw)/2)
	for i := 0; i < len(raw); i += 2 {
		member := raw[i]
		scoreStr := raw[i+1]
		score, err := parseZScore(scoreStr)
		if err != nil {
			return nil, fmt.Errorf("redis: invalid zscan score %q: %w", scoreStr, err)
		}
		out = append(out, ZSetEntry{Member: member, Score: score})
	}
	return out, nil
}

func parseZScore(scoreStr string) (float64, error) {
	s := strings.TrimSpace(scoreStr)
	if s == "" {
		return 0, fmt.Errorf("empty")
	}

	// ParseFloat accepts inf/NaN but those can't be marshaled by encoding/json.
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, err
	}
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return 0, fmt.Errorf("non-finite")
	}
	// Extra guard: normalize -0 to 0
	if f == 0 {
		f = 0
	}
	return f, nil
}
