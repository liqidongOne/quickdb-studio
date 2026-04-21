.PHONY: webui-install webui-build webui-copy build-webui build go-build clean

WEBUI_DIR := webui
WEBUI_DIST := $(WEBUI_DIR)/dist
EMBED_DIST := internal/webassets/webui_dist

webui-install:
	cd $(WEBUI_DIR) && npm install

webui-build:
	cd $(WEBUI_DIR) && npm run build

webui-copy:
	rm -rf $(EMBED_DIST)
	mkdir -p $(EMBED_DIST)
	cp -r $(WEBUI_DIST)/* $(EMBED_DIST)/

go-build:
	go build -o dist/quickdb-studio ./cmd/quickdb-studio

build-webui: webui-install webui-build webui-copy

# Full build pipeline:
# 1) build webui
# 2) copy dist into internal/webassets/webui_dist for go:embed
# 3) build Go binary
build: build-webui go-build

clean:
	rm -rf $(EMBED_DIST)
