module github.com/liqidongOne/quickdb-studio

// 最小 HTTP 服务（Task 1）
go 1.22.3

toolchain go1.22.6

require (
	github.com/go-chi/chi/v5 v5.0.12
	github.com/go-sql-driver/mysql v1.8.1
	github.com/redis/go-redis/v9 v9.6.1
	vitess.io/vitess v0.19.4
)

require (
	filippo.io/edwards25519 v1.1.0 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/golang/glog v1.2.0 // indirect
	github.com/golang/protobuf v1.5.4 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	golang.org/x/sys v0.20.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240304212257-790db918fca8 // indirect
	google.golang.org/grpc v1.62.1 // indirect
	google.golang.org/protobuf v1.33.0 // indirect
)
