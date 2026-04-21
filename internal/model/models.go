package model

// OkResp is the standard success response.
type OkResp struct {
	Ok bool `json:"ok"`
}

// ErrorResp is the standard error response.
type ErrorResp struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// ConnType represents the backend connection type.
type ConnType string

const (
	ConnTypeMySQL ConnType = "mysql"
	ConnTypeRedis ConnType = "redis"
)

// Connection represents a saved connection profile.
//
// NOTE: timestamps use Unix milli for easy persistence and cross-language consumption.
type Connection struct {
	ID        string   `json:"id"`
	Type      ConnType `json:"type"`
	Name      string   `json:"name"`
	CreatedAt int64    `json:"createdAt"`
	UpdatedAt int64    `json:"updatedAt"`

	MySQL *MySQLConfig `json:"mysql,omitempty"`
	Redis *RedisConfig `json:"redis,omitempty"`
}

type MySQLConfig struct {
	Host            string `json:"host"`
	Port            int    `json:"port"`
	Username        string `json:"username"`
	Password        string `json:"password"` // MVP: 明文落盘；严禁日志打印
	DefaultDatabase string `json:"defaultDatabase,omitempty"`
	SSLEnabled      bool   `json:"sslEnabled,omitempty"`
}

type RedisConfig struct {
	Addr       string `json:"addr"` // host:port
	Username   string `json:"username,omitempty"`
	Password   string `json:"password,omitempty"` // MVP: 明文落盘；严禁日志打印
	DB         int    `json:"db,omitempty"`
	TLSEnabled bool   `json:"tlsEnabled,omitempty"`
}
