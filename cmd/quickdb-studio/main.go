package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/liqidongOne/quickdb-studio/internal/httpapi"
	"github.com/liqidongOne/quickdb-studio/internal/security"
)

func main() {
	// Migration: also accept the old env var name.
	token := os.Getenv("QUICKDB_STUDIO_TOKEN")
	if token == "" {
		token = os.Getenv("SOLO_DB_CLIENT_TOKEN")
	}
	if token == "" {
		t, err := security.NewToken32()
		if err != nil {
			log.Fatalf("generate token failed: %v", err)
		}
		token = t
	}

	addr := "127.0.0.1:17890"
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("listen %s failed: %v", addr, err)
	}

	srv := &http.Server{
		Handler:           httpapi.NewRouter(token),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("quickdb-studio started: http://%s", addr)
		log.Printf("local token: %s", token)
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	log.Printf("quickdb-studio shutdown complete")
}

