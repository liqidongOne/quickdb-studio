import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Space, Table, Tag, Typography, message, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MySQLTableColumn, MySQLTableIndex, MySQLTableMetaResp } from "../../api/mysql";
import { getTableMeta } from "../../api/mysql";
import type { MysqlSchemaTabPayload } from "../types";
import CopyText from "../../components/CopyText";
import { apiPost, isAuthError } from "../../api/client";

function includesQ(v: unknown, q: string): boolean {
  if (!q) return true;
  const s = String(v ?? "").toLowerCase();
  return s.includes(q);
}

export default function MysqlSchemaTab(props: MysqlSchemaTabPayload) {
  const { connId, connName, db, table, defaultActive } = props;

  const [active, setActive] = useState<"columns" | "indexes" | "ddl">(defaultActive);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [authHint, setAuthHint] = useState(false);
  const [meta, setMeta] = useState<MySQLTableMetaResp | null>(null);

  const [ddlLoading, setDdlLoading] = useState(false);
  const [ddlErr, setDdlErr] = useState("");
  const [ddlText, setDdlText] = useState<string>("");

  useEffect(() => {
    setActive(defaultActive);
  }, [defaultActive]);

  const refresh = useCallback(async () => {
    setErr("");
    setAuthHint(false);
    setLoading(true);
    try {
      const data = await getTableMeta(connId, db, table);
      setMeta(data);
    } catch (e) {
      if (isAuthError(e)) setAuthHint(true);
      setErr(String(e));
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [connId, db, table]);

  function qId(s: string) {
    return "`" + String(s ?? "").replace(/`/g, "``") + "`";
  }

  const refreshDDL = useCallback(async () => {
    setDdlErr("");
    setDdlLoading(true);
    try {
      const sql = `SHOW CREATE TABLE ${qId(db)}.${qId(table)};`;
      const data = await apiPost<{ columns: string[]; rows: any[][] }>(`/api/v1/mysql/${encodeURIComponent(connId)}/query`, { sql, db });
      const cols = data.columns ?? [];
      const rows = data.rows ?? [];
      if (!rows[0] || rows[0].length === 0) {
        setDdlText("");
        setDdlErr("空结果");
        return;
      }
      const idx = cols.findIndex((c) => /create/i.test(c));
      const ddl = idx >= 0 ? rows[0]?.[idx] : rows[0]?.[1] ?? rows[0]?.[0];
      setDdlText(String(ddl ?? ""));
    } catch (e) {
      if (isAuthError(e)) setAuthHint(true);
      setDdlErr(String(e));
      setDdlText("");
    } finally {
      setDdlLoading(false);
    }
  }, [connId, db, table]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 进入 DDL tab 时按需加载一次
  useEffect(() => {
    if (active === "ddl" && !ddlText && !ddlLoading && !ddlErr) {
      void refreshDDL();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const q = search.trim().toLowerCase();

  const filteredColumns = useMemo(() => {
    const cols = meta?.columns ?? [];
    return cols.filter((c) => {
      return (
        includesQ(c.name, q) ||
        includesQ(c.dataType, q) ||
        includesQ(c.columnType, q) ||
        includesQ(c.columnKey, q) ||
        includesQ(c.extra, q) ||
        includesQ(c.defaultValue, q) ||
        includesQ(c.comment, q)
      );
    });
  }, [meta?.columns, q]);

  const filteredIndexes = useMemo(() => {
    const idxs = meta?.indexes ?? [];
    return idxs.filter((i) => {
      return includesQ(i.name, q) || includesQ(i.columnName, q) || includesQ(i.indexType, q) || includesQ(i.comment, q);
    });
  }, [meta?.indexes, q]);

  const columnsCols = useMemo<ColumnsType<MySQLTableColumn>>(
    () => [
      {
        title: "name",
        dataIndex: "name",
        width: 220,
        fixed: "left",
        render: (v: string) => (
          <Space size={6}>
            <Typography.Text code>{v}</Typography.Text>
            <CopyText text={v} buttonProps={{ size: "small", type: "link" }}>
              复制
            </CopyText>
          </Space>
        )
      },
      { title: "dataType", dataIndex: "dataType", width: 140 },
      { title: "columnType", dataIndex: "columnType", width: 220 },
      {
        title: "nullable",
        dataIndex: "isNullable",
        width: 90,
        render: (v: boolean) => (v ? <Tag color="orange">YES</Tag> : <Tag color="green">NO</Tag>)
      },
      {
        title: "default",
        dataIndex: "defaultValue",
        width: 160,
        render: (v: string | null | undefined) => (
          <Typography.Text style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{v ?? ""}</Typography.Text>
        )
      },
      { title: "extra", dataIndex: "extra", width: 160 },
      { title: "key", dataIndex: "columnKey", width: 120 },
      { title: "#", dataIndex: "ordinalPosition", width: 70 },
      { title: "comment", dataIndex: "comment", width: 360 }
    ],
    []
  );

  const indexesCols = useMemo<ColumnsType<MySQLTableIndex>>(
    () => [
      {
        title: "name",
        dataIndex: "name",
        width: 220,
        fixed: "left",
        render: (v: string) => (
          <Space size={6}>
            <Typography.Text code>{v}</Typography.Text>
            <CopyText text={v} buttonProps={{ size: "small", type: "link" }}>
              复制
            </CopyText>
          </Space>
        )
      },
      {
        title: "unique",
        dataIndex: "nonUnique",
        width: 110,
        render: (v: boolean) => (v ? <Tag>Non-Unique</Tag> : <Tag color="green">Unique</Tag>)
      },
      { title: "seq", dataIndex: "seqInIndex", width: 70 },
      {
        title: "column",
        dataIndex: "columnName",
        width: 220,
        render: (v: string) => (
          <Space size={6}>
            <Typography.Text code>{v}</Typography.Text>
            <CopyText text={v} buttonProps={{ size: "small", type: "link" }}>
              复制
            </CopyText>
          </Space>
        )
      },
      { title: "type", dataIndex: "indexType", width: 120 },
      { title: "comment", dataIndex: "comment", width: 360 }
    ],
    []
  );

  return (
    <div style={{ height: "100%", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ flex: "0 0 auto" }}>
        <Space wrap style={{ marginBottom: 8 }}>
          <Tag color="blue">{connName || connId}</Tag>
          <Tag>{db}</Tag>
          <Tag color="purple">{table}</Tag>
          <Input
            placeholder="搜索列/索引/注释..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Button onClick={() => void refresh()} loading={loading}>
            刷新
          </Button>
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${db}.${table}`);
                void message.success("已复制表名");
              } catch (e) {
                void message.error(`复制失败：${String(e)}`);
              }
            }}
          >
            复制表名
          </Button>
        </Space>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        {authHint ? (
          <Alert
            type="warning"
            showIcon
            message="Token 未设置或已失效"
            description="请在顶部输入并保存 Token，然后点击刷新。"
            action={
              <Button
                size="small"
                onClick={() => {
                  const el = document.getElementById("solo-token-input") as HTMLInputElement | null;
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  el?.focus();
                }}
              >
                去设置 Token
              </Button>
            }
            style={{ marginBottom: 12 }}
          />
        ) : null}

        {err ? (
          <Alert
            type="error"
            showIcon
            message="加载失败"
            description={<Typography.Text style={{ whiteSpace: "pre-wrap" }}>{err}</Typography.Text>}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <Tabs
          activeKey={active}
          onChange={(k) => setActive(k as "columns" | "indexes" | "ddl")}
          items={[
            {
              key: "columns",
              label: `Columns (${meta?.columns?.length ?? 0})`,
              children: (
                <Table<MySQLTableColumn>
                  rowKey={(r) => r.name}
                  size="small"
                  loading={loading}
                  columns={columnsCols}
                  dataSource={filteredColumns}
                  pagination={{ pageSize: 50, showSizeChanger: true, hideOnSinglePage: false, position: ["topRight", "bottomRight"] }}
                  tableLayout="fixed"
                  scroll={{ x: 1400, y: 560 }}
                  locale={{ emptyText: meta ? "空" : "加载中…" }}
                />
              )
            },
            {
              key: "indexes",
              label: `Indexes (${meta?.indexes?.length ?? 0})`,
              children: (
                <Table<MySQLTableIndex>
                  rowKey={(r) => `${r.name}:${r.seqInIndex}:${r.columnName}`}
                  size="small"
                  loading={loading}
                  columns={indexesCols}
                  dataSource={filteredIndexes}
                  pagination={{ pageSize: 50, showSizeChanger: true, hideOnSinglePage: false, position: ["topRight", "bottomRight"] }}
                  tableLayout="fixed"
                  scroll={{ x: 1200, y: 560 }}
                  locale={{ emptyText: meta ? "空" : "加载中…" }}
                />
              )
            },
            {
              key: "ddl",
              label: "DDL",
              children: (
                <div>
                  <Space wrap style={{ marginBottom: 8 }}>
                    <Button onClick={() => void refreshDDL()} loading={ddlLoading}>
                      刷新 DDL
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(ddlText);
                          void message.success("已复制 DDL");
                        } catch (e) {
                          void message.error(`复制失败：${String(e)}`);
                        }
                      }}
                      disabled={!ddlText}
                    >
                      复制 DDL
                    </Button>
                    <Tag color="blue">SHOW CREATE TABLE</Tag>
                  </Space>

                  {ddlErr ? (
                    <Alert
                      type="error"
                      showIcon
                      message="DDL 加载失败"
                      description={<Typography.Text style={{ whiteSpace: "pre-wrap" }}>{ddlErr}</Typography.Text>}
                      style={{ marginBottom: 12 }}
                    />
                  ) : null}

                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: 12,
                      lineHeight: 1.5,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      maxHeight: "60vh",
                      overflow: "auto",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8,
                      padding: 10
                    }}
                  >
                    {ddlLoading ? "加载中..." : ddlText || "暂无 DDL（点击“刷新 DDL”）"}
                  </pre>
                </div>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
