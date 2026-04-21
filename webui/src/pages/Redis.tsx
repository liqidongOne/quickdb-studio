import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Form, Input, InputNumber, List, Select, Space, Tag } from "antd";
import { apiPost } from "../api/client";
import useConnections from "../hooks/useConnections";

type RedisScanResp = {
  keys: string[];
  nextCursor: string;
};

export default function Redis() {
  const { redisConnections } = useConnections();

  const [connId, setConnId] = useState("");
  const [pattern, setPattern] = useState("*");
  const [count, setCount] = useState(50);

  const [keys, setKeys] = useState<string[]>([]);
  const [cursor, setCursor] = useState("0");
  const [nextCursor, setNextCursor] = useState("0");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canMore = useMemo(() => nextCursor !== "0" && nextCursor !== "", [nextCursor]);

  const connOptions = useMemo(
    () =>
      redisConnections.map((c) => {
        const addr = c.redis?.addr ?? "";
        const db = c.redis?.db;
        const label = `${c.name} (${addr}${db === undefined || db === null ? "" : ` db=${db}`})`;
        return { value: c.id, label };
      }),
    [redisConnections]
  );

  // 连接切换时清空结果与错误
  useEffect(() => {
    setErr("");
    setKeys([]);
    setCursor("0");
    setNextCursor("0");
  }, [connId]);

  async function scan(reset: boolean) {
    setErr("");
    const trimmedConnId = connId.trim();
    if (!trimmedConnId) {
      setErr("请选择连接");
      return;
    }
    setLoading(true);
    try {
      const cur = reset ? "0" : nextCursor;
      const body = { pattern: pattern || "", cursor: cur, count: Number(count) || 50 };
      const data = await apiPost<RedisScanResp>(`/api/v1/redis/${encodeURIComponent(trimmedConnId)}/scan`, body);

      setCursor(cur);
      setNextCursor(data.nextCursor);
      setKeys((prev) => (reset ? data.keys : [...prev, ...data.keys]));
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Redis Scan（readonly）">
      <Form layout="vertical">
        <Form.Item label="连接">
          <Select
            value={connId || undefined}
            placeholder={redisConnections.length ? "请选择连接" : "暂无 Redis 连接，请先去 Connections 创建"}
            options={connOptions}
            onChange={(v) => setConnId(v ?? "")}
            allowClear
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item label="pattern">
          <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="例如：user:*" />
        </Form.Item>

        <Form.Item label="count">
          <InputNumber value={count} min={1} max={10000} onChange={(v) => setCount(Number(v) || 50)} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item>
          <Space wrap>
            <Button type="primary" onClick={() => void scan(true)} loading={loading} disabled={!connId.trim()}>
              Scan（reset）
            </Button>
            <Button onClick={() => void scan(false)} loading={loading} disabled={loading || !connId.trim() || !canMore}>
              More（append）
            </Button>
            <Space size="small" wrap>
              <Tag color="blue">cursor={cursor}</Tag>
              <Tag color={canMore ? "green" : "default"}>nextCursor={nextCursor}</Tag>
              <Tag>keys={keys.length}</Tag>
            </Space>
          </Space>
        </Form.Item>
      </Form>

      {err ? <Alert type="error" showIcon message="扫描失败" description={<pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{err}</pre>} /> : null}

      <List
        style={{ marginTop: 12 }}
        bordered
        header={
          <Space size="small" wrap>
            <Tag color="blue">cursor={cursor}</Tag>
            <Tag color={canMore ? "green" : "default"}>nextCursor={nextCursor}</Tag>
          </Space>
        }
        dataSource={keys}
        locale={{ emptyText: connId.trim() ? "暂无数据（先点击 Scan）" : "请先选择连接" }}
        renderItem={(k, idx) => (
          <List.Item key={`${k}-${idx}`}>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{k}</span>
          </List.Item>
        )}
      />
    </Card>
  );
}
