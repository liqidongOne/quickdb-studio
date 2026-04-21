package httpapi

import (
	"errors"
	"fmt"

	"github.com/liqidongOne/quickdb-studio/internal/model"
	"github.com/liqidongOne/quickdb-studio/internal/storage"
)

// ConnLoadError provides a machine-readable error code for connection loading.
type ConnLoadError struct {
	Code string
	Err  error
}

func (e *ConnLoadError) Error() string {
	if e == nil {
		return ""
	}
	if e.Err == nil {
		return e.Code
	}
	return fmt.Sprintf("%s: %v", e.Code, e.Err)
}

func (e *ConnLoadError) Unwrap() error { return e.Err }

// loadConn loads a connection from store by id and validates its type.
func loadConn(store *storage.Store, id string, typ model.ConnType) (*model.Connection, error) {
	if store == nil {
		return nil, &ConnLoadError{Code: "store_not_initialized"}
	}
	if id == "" {
		return nil, &ConnLoadError{Code: "bad_request", Err: errors.New("missing connId")}
	}

	conns, err := store.LoadConnections()
	if err != nil {
		return nil, &ConnLoadError{Code: "storage_error", Err: err}
	}
	for i := range conns {
		if conns[i].ID != id {
			continue
		}
		if conns[i].Type != typ {
			return nil, &ConnLoadError{Code: "type_mismatch"}
		}
		return &conns[i], nil
	}
	return nil, &ConnLoadError{Code: "not_found"}
}
