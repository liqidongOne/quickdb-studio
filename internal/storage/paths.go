package storage

import (
	"io"
	"os"
	"path/filepath"
)

const (
	AppName    = "quickdb-studio"
	OldAppName = "solo-db-client"
)

func BaseDir() (string, error) {
	cfgDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	newDir := filepath.Join(cfgDir, AppName)
	oldDir := filepath.Join(cfgDir, OldAppName)

	// Migration: if old config exists and new does not, migrate it.
	if _, err := os.Stat(newDir); os.IsNotExist(err) {
		if _, err2 := os.Stat(oldDir); err2 == nil {
			_ = os.MkdirAll(newDir, 0o755)
			_ = migrateFile(filepath.Join(oldDir, "connections.json"), filepath.Join(newDir, "connections.json"))
		}
	}

	return newDir, nil
}

func ConnectionsPath() (string, error) {
	baseDir, err := BaseDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(baseDir, "connections.json"), nil
}

func migrateFile(oldPath, newPath string) error {
	if _, err := os.Stat(newPath); err == nil {
		return nil
	}
	if _, err := os.Stat(oldPath); err != nil {
		return nil
	}
	// try rename first
	if err := os.Rename(oldPath, newPath); err == nil {
		return nil
	}
	// fallback to copy
	src, err := os.Open(oldPath)
	if err != nil {
		return err
	}
	defer src.Close()

	if err := os.MkdirAll(filepath.Dir(newPath), 0o755); err != nil {
		return err
	}
	dst, err := os.Create(newPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return err
	}
	_ = dst.Sync()
	_ = os.Remove(oldPath)
	return nil
}
