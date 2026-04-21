package redix

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/liqidongOne/quickdb-studio/internal/model"
)

const (
	defaultDialTimeout = 5 * time.Second
	defaultPingTimeout = 5 * time.Second
)

// Open opens a Redis client with optional TLS and validates connectivity via PING.
//
// TLS requirements:
// - MinVersion: TLS1.2
func Open(cfg model.RedisConfig) (*redis.Client, error) {
	if cfg.Addr == "" {
		return nil, fmt.Errorf("redis: empty addr")
	}

	opt := &redis.Options{
		Addr:        cfg.Addr,
		Username:    cfg.Username,
		Password:    cfg.Password,
		DB:          cfg.DB,
		DialTimeout: defaultDialTimeout,
	}
	if cfg.TLSEnabled {
		opt.TLSConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	}

	c := redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), defaultPingTimeout)
	defer cancel()
	if err := c.Ping(ctx).Err(); err != nil {
		_ = c.Close()
		return nil, err
	}

	return c, nil
}
