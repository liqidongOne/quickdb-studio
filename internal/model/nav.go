package model

// NavConn is a lightweight connection node used by the navigation tree.
type NavConn struct {
	ID   string   `json:"id"`
	Name string   `json:"name"`
	Type ConnType `json:"type"`
}

// NavTreeResp is the response for GET /api/v1/nav/tree.
// It groups connections by type for easy UI rendering.
type NavTreeResp struct {
	MySQL []NavConn `json:"mysql"`
	Redis []NavConn `json:"redis"`
}

