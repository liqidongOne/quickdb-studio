import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Input, Select, Space, Table, Tag, Typography, Card } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiPost } from "../api/client";
import useConnections from "../hooks/useConnections";
import useMysqlDatabases from "../hooks/useMysqlDatabases";

type MysqlQueryResp = {
  columns: string[];
  rows: any[][];
  truncated: boolean;
  warnings?: string[];
  elapsedMs: number;
};

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

function normalizeSelectValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const anyV = v as any;
    // antd Select 在某些配置下可能返回 { value, label }
    if (anyV && (typeof anyV.value === "string" || typeof anyV.value === "number")) {
      return String(anyV.value);
    }
  }
  return String(v);
}

export default function Mysql() {
  const { mysqlConnections } = useConnections();

  const [connId, setConnId] = useState<string>("");
  const selectedConn = useMemo(() => mysqlConnections.find((c) => c.id === connId), [connId, mysqlConnections]);

  const { databases, loading: dbLoading, error: dbError } = useMysqlDatabases(connId);
  const [selectedDb, setSelectedDb] = useState<string>("");

  const [sql, setSql] = useState<string>("select 1 as ok");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [resp, setResp] = useState<MysqlQueryResp | null>(null);

  // 连接切换时，清空查询结果与错误，并等待 databases 列表重新加载后自动选择默认 db
  useEffect(() => {
    setErr("");
    setResp(null);
    setSelectedDb("");
  }, [connId]);

  // databases 加载完成后，自动选择 db：优先 defaultDatabase（且存在于列表），否则选第一个
  useEffect(() => {
    if (!connId.trim()) {
      setSelectedDb("");
      return;
    }
    if (!databases || databases.length === 0) {
      setSelectedDb("");
      return;
    }

    const preferred = (selectedConn?.mysql?.defaultDatabase ?? "").trim();
    const preferredOk = preferred && databases.includes(preferred);
    const nextDb = preferredOk ? preferred : databases[0];

    setSelectedDb((prev) => {
      if (prev && databases.includes(prev)) return prev; // 用户已选择且仍有效
      return nextDb;
    });
  }, [connId, databases, selectedConn?.mysql?.defaultDatabase]);

  const tableColumns = useMemo<ColumnsType<Record<string, unknown>>>(() => {
    if (!resp?.columns?.length) return [];
    return resp.columns.map((c, idx) => ({
      title: c,
      dataIndex: c,
      key: c || String(idx),
      render: (v: unknown) => (
        <Typography.Text style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          {v === null || v === undefined ? "" : String(v)}
        </Typography.Text>
      )
    }));
  }, [resp?.columns]);

  const tableData = useMemo(() => {
    if (!resp) return [];
    const cols = resp.columns ?? [];
    const rows = resp.rows ?? [];
    return rows.map((r, i) => {
      const obj: Record<string, unknown> = { key: i };
      cols.forEach((c, j) => {
        obj[c] = r?.[j];
      });
      return obj;
    });
  }, [resp]);

  const run = useCallback(async () => {
    setErr("");
    setResp(null);
    const connIdStr = toStr(connId).trim();
    const dbStr = toStr(selectedDb).trim();
    const sqlStr = toStr(sql).trim();

    if (!connIdStr) {
      setErr("请选择连接");
      return;
    }
    if (!dbStr) {
      setErr("请选择数据库");
      return;
    }
    if (!sqlStr) {
      setErr("SQL 不能为空");
      return;
    }
    setLoading(true);
    try {
      const body: { sql: string; db: string } = { sql: sqlStr, db: dbStr };
      const data = await apiPost<MysqlQueryResp>(`/api/v1/mysql/${encodeURIComponent(connIdStr)}/query`, body);
      setResp(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [connId, selectedDb, sql]);

  const connOptions = useMemo(
    () =>
      mysqlConnections.map((c) => {
        const host = c.mysql?.host ?? "";
        const port = c.mysql?.port ?? "";
        const db = c.mysql?.defaultDatabase ?? "";
        const label = `${c.name} (${host}:${port}${db ? ` db=${db}` : ""})`;
        return { value: String(c.id), label: String(label) };
      }),
    [mysqlConnections]
  );

  const dbOptions = useMemo(() => databases.map((d) => ({ value: String(d), label: String(d) })), [databases]);

  return (
    <Card title="MySQL Query（readonly）">
      <Form layout="vertical">
        <Form.Item label="连接">
          <Select
            value={connId || undefined}
            placeholder={mysqlConnections.length ? "请选择连接" : "暂无 MySQL 连接，请先去 Connections 创建"}
            options={connOptions}
            onChange={(v) => setConnId(normalizeSelectValue(v))}
            allowClear
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item label="数据库">
          <Select
            value={selectedDb || undefined}
            placeholder={connId ? (dbLoading ? "加载中..." : "请选择数据库") : "请先选择连接"}
            options={dbOptions}
            onChange={(v) => setSelectedDb(normalizeSelectValue(v))}
            loading={dbLoading}
            disabled={!connId.trim()}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item label="SQL">
          <Input.TextArea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            rows={8}
            placeholder="例如：select 1 as ok"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
        </Form.Item>

        <Form.Item>
          <Space wrap>
            <Button
              type="primary"
              onClick={() => void run()}
              loading={loading}
              disabled={!toStr(connId).trim() || !toStr(selectedDb).trim() || !toStr(sql).trim()}
            >
              执行
            </Button>
            {resp ? (
              <Space size="small" wrap>
                <Tag color="blue">elapsedMs={resp.elapsedMs}</Tag>
                <Tag color={resp.truncated ? "orange" : "green"}>truncated={String(resp.truncated)}</Tag>
                <Tag color={resp.warnings && resp.warnings.length > 0 ? "gold" : "default"}>
                  warnings={(resp.warnings?.length ?? 0).toString()}
                </Tag>
              </Space>
            ) : null}
          </Space>
        </Form.Item>
      </Form>

      {dbError ? (
        <Alert
          type="error"
          showIcon
          message="加载数据库失败"
          description={<Typography.Text style={{ whiteSpace: "pre-wrap" }}>{dbError}</Typography.Text>}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {err ? (
        <Alert
          type="error"
          showIcon
          message="执行失败"
          description={<Typography.Text style={{ whiteSpace: "pre-wrap" }}>{err}</Typography.Text>}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {resp?.warnings && resp.warnings.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          message={`Warnings（${resp.warnings.length}）`}
          description={
            <Typography.Text style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {resp.warnings.join("\n")}
            </Typography.Text>
          }
          style={{ marginBottom: 12 }}
        />
      ) : null}

      <Table<Record<string, unknown>>
        rowKey="key"
        columns={tableColumns}
        dataSource={tableData}
        pagination={{ pageSize: 50, showSizeChanger: true }}
        scroll={{ x: true }}
        locale={{ emptyText: resp ? "空结果" : "请先选择连接/数据库并执行 SQL" }}
      />
    </Card>
  );
}
