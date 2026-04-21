package webassets

import (
	"embed"
	"io/fs"
)

// dist embeds the built WebUI assets.
//
// Build pipeline (see Makefile):
//   1) webui: npm install && npm run build
//   2) copy webui/dist -> internal/webassets/webui_dist
//
// Note: go:embed does NOT support **, so we list patterns explicitly.
//
//go:embed webui_dist/* webui_dist/assets/*
var dist embed.FS

// DistFS is an fs.FS rooted at "webui_dist/".
// Paths are like: "index.html", "assets/xxx.js".
var DistFS fs.FS

func init() {
	sub, err := fs.Sub(dist, "webui_dist")
	if err != nil {
		// If this panics during build, it usually means the build pipeline didn't
		// copy the WebUI dist output to internal/webassets/webui_dist.
		panic(err)
	}
	DistFS = sub
}

