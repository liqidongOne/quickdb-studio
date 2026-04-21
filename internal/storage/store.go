package storage

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/liqidongOne/quickdb-studio/internal/model"
)

type Store struct {
	mu sync.Mutex

	baseDir         string
	connectionsPath string
}

func NewStore() (*Store, error) {
	baseDir, err := BaseDir()
	if err != nil {
		return nil, err
	}
	connectionsPath, err := ConnectionsPath()
	if err != nil {
		return nil, err
	}
	return &Store{
		baseDir:         baseDir,
		connectionsPath: connectionsPath,
	}, nil
}

func (s *Store) LoadConnections() ([]model.Connection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, err := os.ReadFile(s.connectionsPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []model.Connection{}, nil
		}
		return nil, err
	}

	var conns []model.Connection
	if len(b) == 0 {
		return []model.Connection{}, nil
	}
	if err := json.Unmarshal(b, &conns); err != nil {
		return nil, err
	}
	return conns, nil
}

// SaveConnections writes connections.json atomically:
// 1) ensure base dir exists
// 2) write to temp file in same directory
// 3) fsync temp file
// 4) rename over target
func (s *Store) SaveConnections(conns []model.Connection) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.MkdirAll(s.baseDir, 0o700); err != nil {
		return err
	}

	dir := filepath.Dir(s.connectionsPath)
	tmp, err := os.CreateTemp(dir, "connections.json.tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }()

	enc := json.NewEncoder(tmp)
	enc.SetIndent("", "  ")
	if err := enc.Encode(conns); err != nil {
		_ = tmp.Close()
		return err
	}

	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}

	// Best-effort: ensure parent directory is present (it should be).
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	return os.Rename(tmpName, s.connectionsPath)
}
