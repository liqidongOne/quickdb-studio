import { useCallback, useMemo, useState } from "react";
import { Alert, AutoComplete, Button, Input, InputNumber, List, Space, Tag, Typography } from "antd";
import { keysSearch } from "../../api/redis";
import { clearRecentPatterns, listRecentPatterns, pushRecentPattern, removeRecentPattern, togglePinPattern } from "../../storage/redisRecentPatterns";

export type RedisKeysTabProps = {
  connId: string;
  connName: string;
  onOpenKey?: (key: string) => void;
};

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

function keywordFromPattern(p: string): string {
  return (p ?? "").replace(/\*/g, "").trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, keyword: string) {
  if (!keyword) return text;
  try {
    const re = new RegExp(escapeRegExp(keyword), "gi");
    const parts = text.split(re);
    const matches = text.match(re);
    if (!matches || matches.length === 0) return text;
    return (
      <span>
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < matches.length ? (
              <mark style={{ background: "rgba(79,140,255,0.28)", color: "inherit", padding: "0 2px", borderRadius: 3 }}>
                {matches[i]}
              </mark>
            ) : null}
          </span>
        ))}
      </span>
    );
  } catch {
    return text;
  }
}

export default function RedisKeysTab(props: RedisKeysTabProps) {
  const { connId, connName, onOpenKey } = props;

  const [pattern, setPattern] = useState<string>("*");
  const [count, setCount] = useState<number>(200);
  const [cursor, setCursor] = useState<string>("0");
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [recent, setRecent] = useState(() => listRecentPatterns());
  const keyword = useMemo(() => keywordFromPattern(pattern), [pattern]);

  // 固定可视高度：约 20 行（避免 Tabs/父容器高度不稳定时无法滚动）
  const listScrollY = 800;

  const canMore = useMemo(() => cursor !== "0", [cursor]);

  const run = useCallback(
    async (mode: "reset" | "append") => {
      setErr("");

      const id = toStr(connId).trim();
      if (!id) {
        setErr("缺少 connId");
        return;
      }

      const reqCursor = mode === "reset" ? "0" : cursor;
      const reqCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 200;

      if (mode === "reset") {
        setKeys([]);
        setCursor("0");
      }

      setLoading(true);
      try {
        const resp = await keysSearch(id, { pattern: pattern || "*", cursor: reqCursor, count: reqCount });
        setCursor(resp.nextCursor ?? "0");
        setKeys((prev) => (mode === "reset" ? resp.keys ?? [] : [...prev, ...(resp.keys ?? [])]));
        if (mode === "reset") {
          setRecent(pushRecentPattern(pattern || "*"));
        }
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    },
    [connId, count, cursor, pattern]
  );

  return (
    <div style={{ height: "100%", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ flex: "0 0 auto" }}>
        <Space wrap style={{ marginBottom: 8 }}>
          <Tag color="blue">{connName || connId}</Tag>
          <Tag color={canMore ? "gold" : "green"}>cursor={cursor}</Tag>
          <Button onClick={() => void run("reset")} loading={loading} type="primary">
            Scan
          </Button>
          <Button onClick={() => void run("append")} loading={loading} disabled={!canMore}>
            More
          </Button>
        </Space>

        <Space wrap>
          <AutoComplete
            style={{ width: 360 }}
            value={pattern}
            onChange={(v) => setPattern(v)}
            options={recent.map((x) => ({ value: x.pattern }))}
            placeholder="pattern（例如 user:*）"
            onSelect={(v) => {
              setPattern(v);
              void run("reset");
            }}
          >
            <Input
              allowClear
              onPressEnter={() => void run("reset")}
              placeholder="pattern（例如 user:*）"
            />
          </AutoComplete>
          <span style={{ fontSize: 12, color: "#888" }}>count</span>
          <InputNumber min={1} max={5000} value={count} onChange={(v) => setCount(Number(v ?? 200))} />
          <Button
            onClick={() => {
              setRecent(clearRecentPatterns());
            }}
          >
            清空最近
          </Button>
        </Space>

        {recent.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <Space size={[6, 6]} wrap>
              {recent.map((x) => (
                <Tag
                  key={x.pattern}
                  color={x.pinned ? "blue" : undefined}
                  closable
                  onClose={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRecent(removeRecentPattern(x.pattern));
                  }}
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={() => {
                    setPattern(x.pattern);
                    void run("reset");
                  }}
                >
                  <span
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRecent(togglePinPattern(x.pattern));
                    }}
                    title="双击置顶/取消置顶"
                  >
                    {x.pinned ? "★ " : ""}
                    {x.pattern}
                  </span>
                </Tag>
              ))}
            </Space>
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 6, fontSize: 12 }}>
              提示：双击某个最近 pattern 可置顶（★），点 Tag 可直接搜索，关闭按钮可删除。
            </Typography.Text>
          </div>
        ) : null}
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        {err ? (
          <Alert
            type="error"
            showIcon
            message="查询失败"
            description={<Typography.Text style={{ whiteSpace: "pre-wrap" }}>{err}</Typography.Text>}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <List
          size="small"
          bordered
          dataSource={keys}
          style={{ height: listScrollY, overflow: "auto" }}
          locale={{ emptyText: loading ? "加载中..." : "暂无 keys（请先 Scan）" }}
          renderItem={(k, idx) => (
            <List.Item key={`${k}:${idx}`}>
              <Typography.Link
                onClick={() => onOpenKey?.(k)}
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                {highlightText(k, keyword)}
              </Typography.Link>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
