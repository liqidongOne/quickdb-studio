import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, InputNumber, Modal, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiPost, isAuthError } from "../../api/client";
import type { MysqlDataTabPayload } from "../types";

type MysqlQueryResp = {
  columns: string[];
  rows: any[][];
  truncated: boolean;
  warnings?: string[];
  elapsedMs: number;
};

function formatCellValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function previewCellValue(s: string): string {
  const oneLine = s.replace(/\r?\n/g, " ⏎ ");
  const max = 120;
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}

export default function MysqlDataTab(props: MysqlDataTabPayload) {
  const { connId, connName, db, table } = props;

  const [limit, setLimit] = useState<number>(() => {
    const n = Number(props.limit);
    return Number.isFinite(n) && n > 0 ? Math.min(5000, Math.max(1, n)) : 200;
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [authHint, setAuthHint] = useState(false);
  const [resp, setResp] = useState<MysqlQueryResp | null>(null);

  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [fullTextOpen, setFullTextOpen] = useState(false);
  const [fullTextTitle, setFullTextTitle] = useState<string>("");
  const [fullTextValue, setFullTextValue] = useState<string>("");

  const run = useCallback(async () => {
    setErr("");
    setAuthHint(false);
    setLoading(true);
    try {
      const sql = `SELECT * FROM ${db}.${table} LIMIT ${limit};`;
      const body: { sql: string; db: string } = { sql, db };
      const data = await apiPost<MysqlQueryResp>(`/api/v1/mysql/${encodeURIComponent(connId)}/query`, body);
      setResp(data);
      setCurrentPage(1);
    } catch (e) {
      if (isAuthError(e)) setAuthHint(true);
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [connId, db, limit, table]);

  // 当切换到别的表（或 conn/db）时自动加载一次
  useEffect(() => {
    setResp(null);
    setErr("");
    setAuthHint(false);
    setCurrentPage(1);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connId, db, table]);

  const openFullText = useCallback((colName: string, value: string) => {
    setFullTextTitle(colName);
    setFullTextValue(value);
    setFullTextOpen(true);
  }, []);

  const tableColumns = useMemo<ColumnsType<Record<string, string>>>(() => {
    const cols = resp?.columns ?? [];
    return cols.map((c, idx) => ({
      title: c,
      dataIndex: c,
      key: c || String(idx),
      width: 220,
      ellipsis: true,
      onCell: (record) => ({
        onClick: () => openFullText(String(c), record[String(c)]),
        style: { cursor: "pointer" },
        title: "点击查看全文"
      }),
      render: (v: string) => (
        <span
          style={{
            display: "inline-block",
            maxWidth: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
          }}
        >
          {previewCellValue(v)}
        </span>
      )
    }));
  }, [openFullText, resp?.columns]);

  const tableData = useMemo(() => {
    if (!resp) return [];
    const cols = resp.columns ?? [];
    const rows = resp.rows ?? [];
    return rows.map((r, i) => {
      const obj: Record<string, string> = { key: String(i) };
      cols.forEach((c, j) => {
        obj[c] = formatCellValue(r?.[j]);
      });
      return obj;
    });
  }, [resp]);

  // 固定表格可视高度：约 15 行（与 Query Tab 保持一致）
  const tableScrollY = 560;

  return (
    <div style={{ height: "100%", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ flex: "0 0 auto" }}>
        <Space wrap style={{ marginBottom: 8 }}>
          <Tag color="blue">{connName || connId}</Tag>
          <Tag>{db}</Tag>
          <Tag color="purple">{table}</Tag>

          <Space size={6}>
            <Typography.Text type="secondary">LIMIT</Typography.Text>
            <InputNumber min={1} max={5000} value={limit} onChange={(v) => setLimit(Number(v) || 200)} />
          </Space>

          <Button type="primary" onClick={() => void run()} loading={loading}>
            Refresh
          </Button>

          {resp ? (
            <Space size="small" wrap>
              <Tag color="blue">elapsedMs={resp.elapsedMs}</Tag>
              <Tag color={resp.truncated ? "orange" : "green"}>truncated={String(resp.truncated)}</Tag>
            </Space>
          ) : null}
        </Space>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "0 0 auto" }}>
          {authHint ? (
            <Alert
              type="warning"
              showIcon
              message="Token 未设置或已失效"
              description="请在顶部输入并保存 Token，然后重试。"
              action={
                <Space>
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
                  <Button size="small" type="primary" onClick={() => void run()} loading={loading}>
                    重试
                  </Button>
                </Space>
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
        </div>

        <div style={{ flex: "1 1 auto", minHeight: 0 }}>
          <Table<Record<string, string>>
            rowKey="key"
            columns={tableColumns}
            dataSource={tableData}
            pagination={{
              current: currentPage,
              pageSize,
              showSizeChanger: true,
              hideOnSinglePage: false,
              pageSizeOptions: [20, 50, 100, 200],
              showTotal: (total) => `共 ${total} 条`,
              position: ["topRight", "bottomRight"],
              onChange: (page, ps) => {
                setCurrentPage(page);
                if (ps !== pageSize) setPageSize(ps);
              }
            }}
            scroll={{ x: (resp?.columns?.length ?? 1) * 220 + 120, y: tableScrollY }}
            sticky
            size="small"
            tableLayout="fixed"
            locale={{ emptyText: loading ? "加载中…" : resp ? "空结果" : "暂无数据" }}
          />
        </div>
      </div>

      <Modal
        title={fullTextTitle ? `全文：${fullTextTitle}` : "全文"}
        open={fullTextOpen}
        onCancel={() => setFullTextOpen(false)}
        footer={[
          <Button
            key="copy_field"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fullTextTitle);
                void message.success("字段名已复制");
              } catch (e) {
                void message.error(`复制失败：${String(e)}`);
              }
            }}
            disabled={!fullTextTitle}
          >
            复制字段名
          </Button>,
          <Button
            key="copy"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fullTextValue);
                void message.success("值已复制");
              } catch (e) {
                void message.error(`复制失败：${String(e)}`);
              }
            }}
          >
            复制值
          </Button>,
          <Button key="close" type="primary" onClick={() => setFullTextOpen(false)}>
            关闭
          </Button>
        ]}
        width={820}
        destroyOnClose
      >
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 12,
            lineHeight: 1.5,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            maxHeight: "60vh",
            overflow: "auto"
          }}
        >
          {fullTextValue}
        </pre>
      </Modal>
    </div>
  );
}

