# mac / Windows 可执行文件构建指南（quickdb-studio）

本文档整理了在 **mac（含 M1）** 上构建本项目可执行文件的常用命令，重点覆盖：
- macOS（Apple Silicon / Intel）可执行文件
- Windows（amd64）可执行文件

> 说明：`go build` 生成的二进制是 **独立可执行文件**，目标机器运行时 **不需要安装 Go**。

---

## 1. 前置条件（构建机）

在构建机（你的 mac）需要：
- Go 1.22+（推荐）
- Node.js 18+（推荐 20+）

检查版本：
```bash
go version
node -v
npm -v
```

---

## 2. 构建前端并嵌入（必须）

本项目会把前端 `webui/dist` **拷贝到** `internal/webassets/webui_dist`，再由 Go 通过 `go:embed` 打进二进制。

在项目根目录执行：
```bash
# 方式 A：使用 Makefile（推荐）
make build-webui
```

如果你没有 `build-webui` 目标（或想手动）：
```bash
cd webui
npm install
npm run build
cd ..

rm -rf internal/webassets/webui_dist
mkdir -p internal/webassets/webui_dist
cp -R webui/dist/* internal/webassets/webui_dist/
```

---

## 3. 构建 macOS 可执行文件

### 3.1 构建 Apple Silicon（M1/M2/M3，darwin/arm64）
```bash
mkdir -p dist
GOOS=darwin GOARCH=arm64 go build -o dist/quickdb-studio-darwin-arm64 ./cmd/quickdb-studio
```

运行：
```bash
export QUICKDB_STUDIO_TOKEN=devtoken   # 或不设，让程序自动生成并打印
./dist/quickdb-studio-darwin-arm64
```

### 3.2 构建 Intel Mac（darwin/amd64）
```bash
mkdir -p dist
GOOS=darwin GOARCH=amd64 go build -o dist/quickdb-studio-darwin-amd64 ./cmd/quickdb-studio
```

运行：
```bash
export QUICKDB_STUDIO_TOKEN=devtoken   # 或不设，让程序自动生成并打印
./dist/quickdb-studio-darwin-amd64
```

---

## 4. 构建 Windows 可执行文件（windows/amd64）

> 备注：在 mac 上交叉编译 Windows exe 是可行的；运行需要在 Windows 机器上。

```bash
mkdir -p dist
GOOS=windows GOARCH=amd64 go build -o dist/quickdb-studio-windows-amd64.exe ./cmd/quickdb-studio
```

在 Windows 上运行（PowerShell 示例）：
```powershell
$env:QUICKDB_STUDIO_TOKEN="devtoken"  # 或不设，让程序自动生成并打印
.\quickdb-studio-windows-amd64.exe
```

---

## 5. 分发与运行注意事项（常见坑）

### 5.1 运行不需要安装 Go
目标机器只要拿到对应平台/架构的二进制即可运行，不需要 Go 环境。

### 5.2 mac 提示“无法打开/无法验证开发者”
常见于从网络下载或通过聊天软件传输后的文件。可让用户：
- Finder 右键 → 打开 → 再确认打开  
或（终端）：
```bash
xattr -dr com.apple.quarantine ./quickdb-studio-darwin-arm64
chmod +x ./quickdb-studio-darwin-arm64
```

### 5.3 “command not found”
通常是因为没有在当前目录执行，mac/Linux 要用：
```bash
./quickdb-studio-darwin-arm64
```
而不是直接 `quickdb-studio-darwin-arm64`。

### 5.4 架构不匹配
- M1 编出来的 `darwin/arm64` 不能给 Intel Mac/Windows/Linux 用
- Windows 需要 `.exe`

可用这些命令自检：
```bash
file ./quickdb-studio-darwin-arm64
uname -m
```
