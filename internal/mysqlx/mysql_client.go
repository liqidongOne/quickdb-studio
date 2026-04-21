package mysqlx

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/liqidongOne/quickdb-studio/internal/model"
)

const (
	defaultDialTimeout  = 5 * time.Second
	defaultRWTimeout    = 30 * time.Second
	defaultMaxOpenConns = 8
	defaultMaxIdleConns = 8
	defaultConnMaxIdle  = 5 * time.Minute
	defaultConnMaxLife  = 30 * time.Minute
)

// Open opens a MySQL connection with a safe default DSN and pool settings.
//
// DSN requirements:
// - parseTime=true
// - timeout/readTimeout/writeTimeout
func Open(cfg model.MySQLConfig) (*sql.DB, error) {
	if cfg.Host == "" {
		return nil, fmt.Errorf("mysql: empty host")
	}
	if cfg.Port == 0 {
		cfg.Port = 3306
	}

	c := mysql.NewConfig()
	c.User = cfg.Username
	c.Passwd = cfg.Password
	c.Net = "tcp"
	c.Addr = fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	c.DBName = cfg.DefaultDatabase
	c.Params = map[string]string{
		"parseTime":    "true",
		"timeout":      defaultDialTimeout.String(),
		"readTimeout":  defaultRWTimeout.String(),
		"writeTimeout": defaultRWTimeout.String(),
	}
	if cfg.SSLEnabled {
		// "preferred" will try TLS first and fall back to plain TCP if the server
		// doesn't support it, which is a pragmatic default for MVP.
		c.TLSConfig = "preferred"
	}

	db, err := sql.Open("mysql", c.FormatDSN())
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(defaultMaxOpenConns)
	db.SetMaxIdleConns(defaultMaxIdleConns)
	db.SetConnMaxIdleTime(defaultConnMaxIdle)
	db.SetConnMaxLifetime(defaultConnMaxLife)

	return db, nil
}
