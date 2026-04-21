import { useState } from "react";
import { clearToken, getToken, setToken } from "./api/client";
import { Alert, Button, ConfigProvider, Drawer, Input, Layout, Space, Tag, Typography, theme } from "antd";
import Connections from "./pages/Connections";
import Workspace from "./workspace/Workspace";

export default function App() {
  const [tokenInput, setTokenInput] = useState<string>(() => getToken() ?? "");
  const [savedToken, setSavedToken] = useState<string>(() => getToken() ?? "");
  const [connectionsDrawerOpen, setConnectionsDrawerOpen] = useState(false);

  // 用 localStorage 中的值作为“实际生效”的 token（避免只改输入框但未保存）
  const currentToken = savedToken || getToken() || "";
  const tokenStatusText = currentToken ? `已设置（长度 ${currentToken.length}）` : "未设置";
  const tokenStatusColor = currentToken ? ("green" as const) : ("red" as const);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header
        style={{
          background: "rgba(15, 24, 42, 0.72)",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          height: "auto",
          lineHeight: "normal",
          padding: "0 16px"
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 0" }}>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Space align="center" wrap style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Title level={4} style={{ margin: 0, color: "rgba(255,255,255,0.92)" }}>
                quickdb-studio
              </Typography.Title>
              <Space align="center" wrap>
                <Button onClick={() => setConnectionsDrawerOpen(true)}>管理连接</Button>
                <Typography.Text style={{ color: "rgba(255,255,255,0.62)" }}>状态</Typography.Text>
                <Tag color={tokenStatusColor}>{tokenStatusText}</Tag>
              </Space>
            </Space>

            <Space align="end" wrap style={{ width: "100%" }}>
              <div style={{ flex: 1, minWidth: 320 }}>
                <Typography.Text style={{ color: "rgba(255,255,255,0.62)" }}>Token（保存到 localStorage）</Typography.Text>
                <Input.Password
                  id="solo-token-input"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="例如：dev-token-xxx"
                  autoComplete="off"
                />
              </div>
              <Button
                type="primary"
                onClick={() => {
                  const t = tokenInput.trim();
                  setToken(t);
                  setSavedToken(t);
                }}
              >
                保存
              </Button>
              <Button
                danger
                onClick={() => {
                  clearToken();
                  setTokenInput("");
                  setSavedToken("");
                }}
              >
                清除
              </Button>
            </Space>

            {!currentToken && (
              <Alert
                type="warning"
                showIcon
                message="未设置 Token"
                description="请先在上方输入并保存 Bearer Token（保存到 localStorage），否则接口调用可能会失败（例如 401/403）。"
              />
            )}

            <Typography.Text style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              API：/api/v1/nav/tree、/api/v1/mysql/&lt;connId&gt;/query、/api/v1/redis/&lt;connId&gt;/keys/search、/api/v1/redis/&lt;connId&gt;/key/preview
            </Typography.Text>
          </Space>
        </div>
      </Layout.Header>

      <Layout.Content style={{ padding: 0 }}>
        <Workspace />
      </Layout.Content>

      <Drawer
        title="管理连接"
        open={connectionsDrawerOpen}
        onClose={() => setConnectionsDrawerOpen(false)}
        placement="right"
        width={800}
        destroyOnClose
      >
        <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
          <Connections />
        </ConfigProvider>
      </Drawer>
    </Layout>
  );
}
