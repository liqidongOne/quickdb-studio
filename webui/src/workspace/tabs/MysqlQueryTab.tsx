import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Drawer, Dropdown, Form, Input, List, Modal, Radio, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiPost, isAuthError } from "../../api/client";
import { loadHistory, pushHistory, type QueryHistoryItem } from "../../storage/queryHistory";
import { addFavorite, listFavorites, removeFavorite, type FavoriteItem } from "../../storage/queryFavorites";
import { downloadText } from "../../utils/download";
import { rowsToCsv, rowsToJson } from "../../utils/serialize";

export type MysqlQueryTabProps = {
  connId: string;
  connName: string;
  db: string;
  table?: string;
  initialSql?: string;
};

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
  // 预览仅显示一小段，避免超长字段“视觉上撑开列”（即使有省略号也会影响观感）
  const oneLine = s.replace(/\r?\n/g, " ⏎ ");
  const max = 120;
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

export default function MysqlQueryTab(props: MysqlQueryTabProps) {
  const { connId, connName, db, table, initialSql } = props;

  const [sql, setSql] = useState<string>(() => initialSql ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [authHint, setAuthHint] = useState(false);
  const [resp, setResp] = useState<MysqlQueryResp | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  // 固定表格可视高度：约 15 行（size="small" 下行高 ~32px）
  const tableScrollY = 560;
  const [fullTextOpen, setFullTextOpen] = useState(false);
  const [fullTextTitle, setFullTextTitle] = useState<string>("");
  const [fullTextValue, setFullTextValue] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>(() => loadHistory());
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favCreateOpen, setFavCreateOpen] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => listFavorites());
  const [favForm] = Form.useForm<{ name: string; note?: string; scope: "current" | "global" }>();

  const exportRows = useCallback(
    (scope: "page" | "all", fmt: "csv" | "json") => {
      if (!resp) {
        void message.warning("暂无结果可导出");
        return;
      }
      const cols = resp.columns ?? [];
      const rowsAll = resp.rows ?? [];
      const rows =
        scope === "all"
          ? rowsAll
          : rowsAll.slice((currentPage - 1) * pageSize, Math.min(rowsAll.length, currentPage * pageSize));

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const base = safeFilename(`${connName || connId}_${db}_${ts}`);
      if (fmt === "csv") {
        const csv = rowsToCsv(cols, rows);
        downloadText(`${base}.csv`, csv, "text/csv;charset=utf-8");
      } else {
        const json = JSON.stringify(rowsToJson(cols, rows), null, 2);
        downloadText(`${base}.json`, json, "application/json;charset=utf-8");
      }
      void message.success("已开始下载");
    },
    [connId, connName, currentPage, db, pageSize, resp]
  );

  const openFullText = useCallback((colName: string, value: unknown) => {
    setFullTextTitle(colName);
    setFullTextValue(formatCellValue(value));
    setFullTextOpen(true);
  }, []);

  // 外部（树联动）传入 initialSql 时，覆盖编辑器内容（不要自动执行）。
  useEffect(() => {
    if (typeof initialSql === "string") {
      setSql(initialSql);
      setErr("");
      setAuthHint(false);
      setResp(null);
      setCurrentPage(1);
    }
  }, [initialSql]);

  // 备注：这里故意用固定 scroll.y，避免 ResizeObserver/布局差异导致表格滚动失效或分页被挤出视野。

  const run = useCallback(async () => {
    setErr("");
    setAuthHint(false);
    setResp(null);

    const connIdStr = toStr(connId).trim();
    const dbStr = toStr(db).trim();
    const sqlStr = toStr(sql).trim();

    if (!connIdStr) {
      setErr("缺少 connId");
      return;
    }
    if (!dbStr) {
      setErr("缺少 db");
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
      setCurrentPage(1);
      setHistory(pushHistory({ connId: connIdStr, db: dbStr, sql: sqlStr }));
    } catch (e) {
      if (isAuthError(e)) setAuthHint(true);
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [connId, db, sql]);

  const tableColumns = useMemo<ColumnsType<Record<string, string>>>(() => {
    if (!resp?.columns?.length) return [];
    return resp.columns.map((c, idx) => ({
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

  return (
    <div style={{ height: "100%", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 上：SQL */}
      <div style={{ flex: "0 0 auto" }}>
        <Space wrap style={{ marginBottom: 8 }}>
          <Tag color="blue">{connName || connId}</Tag>
          <Tag>{db}</Tag>
          {table ? <Tag color="purple">{table}</Tag> : null}
          <Button type="primary" onClick={() => void run()} loading={loading} disabled={!toStr(sql).trim()}>
            Run
          </Button>
          <Button
            onClick={() => {
              setHistory(loadHistory());
              setHistoryOpen(true);
            }}
          >
            历史（{history.filter((h) => h.connId === connId.trim() && h.db === db.trim()).length}）
          </Button>
          <Button
            onClick={() => {
              setFavorites(listFavorites());
              setFavoritesOpen(true);
            }}
          >
            收藏（{favorites.length}）
          </Button>
          <Button
            onClick={() => {
              favForm.setFieldsValue({ name: "", note: "", scope: "current" });
              setFavCreateOpen(true);
            }}
            disabled={!toStr(sql).trim()}
          >
            收藏当前
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: "csv_page", label: "导出 CSV（当前页）" },
                { key: "csv_all", label: "导出 CSV（全部）" },
                { key: "json_page", label: "导出 JSON（当前页）" },
                { key: "json_all", label: "导出 JSON（全部）" }
              ],
              onClick: ({ key }) => {
                if (key === "csv_page") exportRows("page", "csv");
                if (key === "csv_all") exportRows("all", "csv");
                if (key === "json_page") exportRows("page", "json");
                if (key === "json_all") exportRows("all", "json");
              }
            }}
            placement="bottomLeft"
          >
            <Button disabled={!resp}>导出</Button>
          </Dropdown>
          {resp ? (
            <Space size="small" wrap>
              <Tag color="blue">elapsedMs={resp.elapsedMs}</Tag>
              <Tag color={resp.truncated ? "orange" : "green"}>truncated={String(resp.truncated)}</Tag>
              <Tag color={resp.warnings && resp.warnings.length > 0 ? "gold" : "default"}>warnings={(resp.warnings?.length ?? 0).toString()}</Tag>
            </Space>
          ) : null}
        </Space>

        <Input.TextArea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={8}
          placeholder="请输入 SQL"
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        />
      </div>

      {/* 下：Result */}
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* 结果区提示（不参与表格高度计算） */}
        <div style={{ flex: "0 0 auto" }}>
          {authHint ? (
            <Alert
              type="warning"
              showIcon
              message="Token 未设置或已失效"
              description="请在顶部输入并保存 Token，然后重试查询。"
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
        </div>

        {/* 表格区：撑满剩余高度，并计算 scroll.y */}
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
              // 顶部也放一个分页器，避免极端高度下底部分页不可见
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
            locale={{ emptyText: resp ? "空结果" : "请先输入 SQL 并执行" }}
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
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          点击“复制字段名/复制值”可快速拷贝。
        </Typography.Paragraph>
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

      <Drawer title="查询历史" open={historyOpen} onClose={() => setHistoryOpen(false)} width={520} destroyOnClose>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          仅显示当前连接/库（{connName || connId} / {db}）的历史，点击可回填 SQL。
        </Typography.Paragraph>
        <List<QueryHistoryItem>
          size="small"
          dataSource={history.filter((h) => h.connId === connId.trim() && h.db === db.trim())}
          locale={{ emptyText: "暂无历史" }}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: "pointer" }}
              onClick={() => {
                setSql(item.sql);
                setHistoryOpen(false);
              }}
            >
              <div style={{ width: "100%" }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(item.createdAt).toLocaleString()}
                </Typography.Text>
                <pre style={{ margin: "6px 0 0 0", whiteSpace: "pre-wrap", fontSize: 12 }}>{item.sql}</pre>
              </div>
            </List.Item>
          )}
        />
      </Drawer>

      <Drawer title="收藏 SQL" open={favoritesOpen} onClose={() => setFavoritesOpen(false)} width={560} destroyOnClose>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          点击条目可回填 SQL；右侧可删除。你可以收藏到“当前连接/库”或“全局”。
        </Typography.Paragraph>
        <List<FavoriteItem>
          size="small"
          dataSource={favorites}
          locale={{ emptyText: "暂无收藏（可在上方点击“收藏当前”添加）" }}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: "pointer" }}
              onClick={() => {
                setSql(item.sql);
                setFavoritesOpen(false);
              }}
              actions={[
                <Button
                  key="del"
                  size="small"
                  danger
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFavorite(item.id);
                    setFavorites(listFavorites());
                  }}
                >
                  删除
                </Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={8} wrap>
                    <Typography.Text>{item.name}</Typography.Text>
                    {item.connId && item.db ? <Tag>{`${item.connId}/${item.db}`}</Tag> : <Tag>全局</Tag>}
                  </Space>
                }
                description={
                  <div>
                    {item.note ? (
                      <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0 0" }}>
                        {item.note}
                      </Typography.Paragraph>
                    ) : null}
                    <pre style={{ margin: "6px 0 0 0", whiteSpace: "pre-wrap", fontSize: 12 }}>{item.sql}</pre>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>

      <Modal
        title="收藏当前 SQL"
        open={favCreateOpen}
        destroyOnClose
        okText="保存"
        cancelText="取消"
        onCancel={() => setFavCreateOpen(false)}
        onOk={() => favForm.submit()}
      >
        <Form
          form={favForm}
          layout="vertical"
          onFinish={(v) => {
            const name = (v.name ?? "").trim();
            if (!name) {
              void message.error("请输入名称");
              return;
            }
            const scope = v.scope ?? "current";
            addFavorite({
              name,
              note: v.note?.trim() || undefined,
              connId: scope === "current" ? connId.trim() : undefined,
              db: scope === "current" ? db.trim() : undefined,
              sql: sql.trim()
            });
            setFavorites(listFavorites());
            setFavCreateOpen(false);
            void message.success("已收藏");
          }}
          initialValues={{ scope: "current" }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="例如：查最近7天用户" />
          </Form.Item>
          <Form.Item name="note" label="备注（可选）">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="scope" label="范围">
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: "当前连接/库", value: "current" },
                { label: "全局", value: "global" }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
