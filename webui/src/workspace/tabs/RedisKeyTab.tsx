import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Divider, InputNumber, Modal, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { keyPreview, type RedisKeyPreviewResp } from "../../api/redis";

export type RedisKeyTabProps = {
  connId: string;
  connName: string;
  /**
   * 注意：React 的 JSX `key` 为保留属性，无法作为组件 props 传入；
   * 因此这里使用 redisKey。
   */
  redisKey: string;
};

type RedisStringData = { value: string; truncated: boolean };
type RedisHashEntry = { field: string; value: string };
type RedisHashData = { items: RedisHashEntry[]; nextCursor: string };
type RedisSetData = { members: string[]; nextCursor: string };
type RedisZSetEntry = { member: string; score: number };
type RedisZSetData = { items: RedisZSetEntry[]; nextCursor: string };
type RedisListData = { start: number; stop: number; items: string[] };

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

function asObj(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== "object") return null;
  return v as any;
}

function tryPrettyJson(raw: string): { ok: boolean; pretty?: string } {
  const s = (raw ?? "").trim();
  if (!s) return { ok: false };
  // 快速剪枝：不是 JSON 常见开头就不尝试
  if (!(s.startsWith("{") || s.startsWith("["))) return { ok: false };
  try {
    const obj = JSON.parse(s);
    return { ok: true, pretty: JSON.stringify(obj, null, 2) };
  } catch {
    return { ok: false };
  }
}

function previewText(raw: string): string {
  const oneLine = (raw ?? "").replace(/\r?\n/g, " ⏎ ");
  const max = 140;
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}

export default function RedisKeyTab(props: RedisKeyTabProps) {
  const { connId, connName, redisKey } = props;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [meta, setMeta] = useState<Pick<RedisKeyPreviewResp, "key" | "type" | "ttlMs"> | null>(null);

  // Paging states (only used by some types).
  const [scanCount, setScanCount] = useState<number>(200);
  const [cursor, setCursor] = useState<string>("0");

  const [stringData, setStringData] = useState<RedisStringData | null>(null);
  const [hashItems, setHashItems] = useState<RedisHashEntry[]>([]);
  const [setMembers, setSetMembers] = useState<string[]>([]);
  const [zsetItems, setZsetItems] = useState<RedisZSetEntry[]>([]);

  const [listStart, setListStart] = useState<number>(0);
  const [listStop, setListStop] = useState<number>(99);
  const [listItems, setListItems] = useState<string[]>([]);

  const [stringPrettyOpen, setStringPrettyOpen] = useState<boolean>(true);

  // value 弹窗（用于 hash/set/zset 的 value/member）
  const [valueModalOpen, setValueModalOpen] = useState(false);
  const [valueModalTitle, setValueModalTitle] = useState<string>("");
  const [valueModalRaw, setValueModalRaw] = useState<string>("");
  const [valueModalPrettyOpen, setValueModalPrettyOpen] = useState<boolean>(true);

  const openValueModal = useCallback((title: string, raw: string) => {
    setValueModalTitle(title);
    setValueModalRaw(raw);
    setValueModalPrettyOpen(true);
    setValueModalOpen(true);
  }, []);

  const resetDataByType = useCallback(() => {
    setStringData(null);
    setHashItems([]);
    setSetMembers([]);
    setZsetItems([]);
    setListItems([]);
    setCursor("0");
  }, []);

  const loadFirst = useCallback(
    async (opts?: { listStart?: number; listStop?: number }) => {
      setErr("");
      resetDataByType();

      const id = toStr(connId).trim();
      const k = toStr(redisKey).trim();
      if (!id) {
        setErr("缺少 connId");
        return;
      }
      if (!k) {
        setErr("缺少 key");
        return;
      }

      setLoading(true);
      try {
        const resp = await keyPreview(id, { key: k, start: opts?.listStart, stop: opts?.listStop, count: scanCount });
        setMeta({ key: resp.key, type: resp.type, ttlMs: resp.ttlMs });

        const d = asObj(resp.data);
        switch (resp.type) {
          case "string": {
            const value = toStr(d?.value ?? "");
            const truncated = Boolean(d?.truncated);
            setStringData({ value, truncated });
            break;
          }
          case "hash": {
            const items = Array.isArray(d?.items) ? (d?.items as any[]) : [];
            const converted: RedisHashEntry[] = items.map((it) => ({ field: toStr((it as any)?.field), value: toStr((it as any)?.value) }));
            setHashItems(converted);
            setCursor(toStr(d?.nextCursor ?? "0") || "0");
            break;
          }
          case "set": {
            const members = Array.isArray(d?.members) ? (d?.members as any[]) : [];
            setSetMembers(members.map((m) => toStr(m)));
            setCursor(toStr(d?.nextCursor ?? "0") || "0");
            break;
          }
          case "zset": {
            const items = Array.isArray(d?.items) ? (d?.items as any[]) : [];
            const converted: RedisZSetEntry[] = items.map((it) => ({ member: toStr((it as any)?.member), score: Number((it as any)?.score ?? 0) }));
            setZsetItems(converted);
            setCursor(toStr(d?.nextCursor ?? "0") || "0");
            break;
          }
          case "list": {
            const start = Number(d?.start ?? opts?.listStart ?? listStart);
            const stop = Number(d?.stop ?? opts?.listStop ?? listStop);
            const items = Array.isArray(d?.items) ? (d?.items as any[]) : [];
            setListStart(start);
            setListStop(stop);
            setListItems(items.map((it) => toStr(it)));
            break;
          }
          default:
            setErr(`不支持的 Redis 类型：${resp.type}`);
        }
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    },
    [connId, listStart, listStop, redisKey, resetDataByType, scanCount]
  );

  const loadMore = useCallback(async () => {
    if (!meta) return;
    if (!["hash", "set", "zset"].includes(meta.type)) return;
    if (cursor === "0") return;

    setErr("");
    setLoading(true);
    try {
      const resp = await keyPreview(connId, { key: redisKey, cursor, count: scanCount });
      const d = asObj(resp.data);

      // 仅追加数据；meta 仍然更新（TTL 变化等）。
      setMeta({ key: resp.key, type: resp.type, ttlMs: resp.ttlMs });
      const next = toStr(d?.nextCursor ?? "0") || "0";
      setCursor(next);

      if (resp.type === "hash") {
        const items = Array.isArray(d?.items) ? (d?.items as any[]) : [];
        const converted: RedisHashEntry[] = items.map((it) => ({ field: toStr((it as any)?.field), value: toStr((it as any)?.value) }));
        setHashItems((prev) => [...prev, ...converted]);
      } else if (resp.type === "set") {
        const members = Array.isArray(d?.members) ? (d?.members as any[]) : [];
        setSetMembers((prev) => [...prev, ...members.map((m) => toStr(m))]);
      } else if (resp.type === "zset") {
        const items = Array.isArray(d?.items) ? (d?.items as any[]) : [];
        const converted: RedisZSetEntry[] = items.map((it) => ({ member: toStr((it as any)?.member), score: Number((it as any)?.score ?? 0) }));
        setZsetItems((prev) => [...prev, ...converted]);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [connId, cursor, meta, redisKey, scanCount]);

  useEffect(() => {
    void loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connId, redisKey]);

  const header = (
    <Space wrap style={{ marginBottom: 8 }}>
      <Tag color="blue">{connName || connId}</Tag>
      <Tag style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{redisKey}</Tag>
      {meta ? <Tag color="purple">{meta.type}</Tag> : null}
      {meta ? <Tag color={meta.ttlMs < 0 ? "default" : "green"}>ttlMs={meta.ttlMs}</Tag> : null}
      <Button onClick={() => void loadFirst({ listStart, listStop })} loading={loading}>
        Refresh
      </Button>
      {meta && ["hash", "set", "zset"].includes(meta.type) ? (
        <>
          <span style={{ fontSize: 12, color: "#888" }}>count</span>
          <InputNumber min={1} max={5000} value={scanCount} onChange={(v) => setScanCount(Number(v ?? 200))} />
          <Tag color={cursor === "0" ? "green" : "gold"}>nextCursor={cursor}</Tag>
          <Button onClick={() => void loadMore()} loading={loading} disabled={cursor === "0"}>
            More
          </Button>
        </>
      ) : null}
    </Space>
  );

  const stringView = useMemo(() => {
    if (!stringData) return null;
    const pretty = tryPrettyJson(stringData.value);
    return (
      <div>
        <Space wrap style={{ marginBottom: 8 }}>
          <Tag color={stringData.truncated ? "orange" : "green"}>truncated={String(stringData.truncated)}</Tag>
          {pretty.ok ? <Tag color="blue">JSON</Tag> : null}
          {pretty.ok ? (
            <Button size="small" onClick={() => setStringPrettyOpen((v) => !v)}>
              {stringPrettyOpen ? "收起格式化" : "展开格式化"}
            </Button>
          ) : null}
          <Button
            size="small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(stringData.value);
                void message.success("已复制原文");
              } catch (e) {
                void message.error(`复制失败：${String(e)}`);
              }
            }}
          >
            复制原文
          </Button>
          {pretty.ok ? (
            <Button
              size="small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pretty.pretty ?? "");
                  void message.success("已复制格式化 JSON");
                } catch (e) {
                  void message.error(`复制失败：${String(e)}`);
                }
              }}
            >
              复制格式化
            </Button>
          ) : null}
        </Space>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
          }}
        >
          {pretty.ok && stringPrettyOpen ? pretty.pretty : stringData.value}
        </pre>
      </div>
    );
  }, [stringData, stringPrettyOpen]);

  const hashColumns: ColumnsType<RedisHashEntry> = useMemo(
    () => [
      {
        title: "field",
        dataIndex: "field",
        key: "field",
        width: 260,
        render: (v: unknown) => <Typography.Text style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{toStr(v)}</Typography.Text>
      },
      {
        title: "value",
        dataIndex: "value",
        key: "value",
        render: (v: unknown, r) => (
          <Typography.Link
            onClick={() => openValueModal(`hash value：${r.field}`, toStr(v))}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            {previewText(toStr(v))}
          </Typography.Link>
        )
      }
    ],
    [openValueModal]
  );

  const zsetColumns: ColumnsType<RedisZSetEntry> = useMemo(
    () => [
      {
        title: "member",
        dataIndex: "member",
        key: "member",
        width: 360,
        render: (v: unknown) => (
          <Typography.Link
            onClick={() => openValueModal("zset member", toStr(v))}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            {previewText(toStr(v))}
          </Typography.Link>
        )
      },
      { title: "score", dataIndex: "score", key: "score", width: 160, render: (v: unknown) => toStr(v) }
    ],
    [openValueModal]
  );

  const body = useMemo(() => {
    if (!meta) {
      return <Typography.Text type="secondary">加载中...</Typography.Text>;
    }
    if (meta.type === "string") return stringView;
    if (meta.type === "hash") {
      return (
        <Table<RedisHashEntry>
          rowKey={(r) => r.field}
          size="small"
          columns={hashColumns}
          dataSource={hashItems}
          pagination={false}
          tableLayout="fixed"
          scroll={{ x: 900, y: 560 }}
        />
      );
    }
    if (meta.type === "set") {
      // 轻量：用单列 Table，避免长列表 UI 撑开
      return (
        <Table<{ k: string }>
          rowKey={(r) => r.k}
          size="small"
          columns={[
            {
              title: "member",
              dataIndex: "k",
              key: "k",
              render: (v: unknown) => (
                <Typography.Link
                  onClick={() => openValueModal("set member", toStr(v))}
                  style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                >
                  {previewText(toStr(v))}
                </Typography.Link>
              )
            }
          ]}
          dataSource={setMembers.map((m) => ({ k: m }))}
          pagination={false}
          tableLayout="fixed"
          scroll={{ y: 560 }}
        />
      );
    }
    if (meta.type === "zset") {
      return (
        <Table<RedisZSetEntry>
          rowKey={(r) => `${r.member}:${r.score}`}
          size="small"
          columns={zsetColumns}
          dataSource={zsetItems}
          pagination={false}
          tableLayout="fixed"
          scroll={{ x: 700, y: 560 }}
        />
      );
    }
    if (meta.type === "list") {
      return (
        <div>
          <Space wrap style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#888" }}>start</span>
            <InputNumber value={listStart} onChange={(v) => setListStart(Number(v ?? 0))} />
            <span style={{ fontSize: 12, color: "#888" }}>stop</span>
            <InputNumber value={listStop} onChange={(v) => setListStop(Number(v ?? 99))} />
            <Button onClick={() => void loadFirst({ listStart, listStop })} loading={loading}>
              刷新
            </Button>
          </Space>
          <Divider style={{ margin: "8px 0" }} />
          <Table<{ idx: number; v: string }>
            rowKey={(r) => String(r.idx)}
            size="small"
            columns={[
              { title: "#", dataIndex: "idx", key: "idx", width: 80 },
              {
                title: "value",
                dataIndex: "v",
                key: "v",
                render: (_v: unknown, r) => (
                  <Typography.Link
                    onClick={() => openValueModal(`list[${r.idx}]`, r.v)}
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                  >
                    {previewText(r.v)}
                  </Typography.Link>
                )
              }
            ]}
            dataSource={listItems.map((v, i) => ({ idx: listStart + i, v }))}
            pagination={false}
            tableLayout="fixed"
            scroll={{ x: 700, y: 560 }}
          />
        </div>
      );
    }
    return <Typography.Text type="secondary">暂不支持：{meta.type}</Typography.Text>;
  }, [hashColumns, hashItems, listItems, listStart, listStop, loadFirst, loading, meta, openValueModal, setMembers, stringView, zsetColumns, zsetItems]);

  return (
    <div style={{ height: "100%", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ flex: "0 0 auto" }}>{header}</div>

      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
        {err ? (
          <Alert
            type="error"
            showIcon
            message="加载失败"
            description={<Typography.Text style={{ whiteSpace: "pre-wrap" }}>{err}</Typography.Text>}
            style={{ marginBottom: 12 }}
          />
        ) : null}
        {body}
      </div>

      <Modal
        title={valueModalTitle || "值"}
        open={valueModalOpen}
        onCancel={() => setValueModalOpen(false)}
        width={860}
        destroyOnClose
        footer={[
          <Button
            key="copy_raw"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(valueModalRaw);
                void message.success("已复制原文");
              } catch (e) {
                void message.error(`复制失败：${String(e)}`);
              }
            }}
          >
            复制原文
          </Button>,
          <Button
            key="toggle_pretty"
            onClick={() => setValueModalPrettyOpen((v) => !v)}
            disabled={!tryPrettyJson(valueModalRaw).ok}
          >
            {valueModalPrettyOpen ? "收起格式化" : "展开格式化"}
          </Button>,
          <Button
            key="copy_pretty"
            onClick={async () => {
              const pretty = tryPrettyJson(valueModalRaw);
              if (!pretty.ok) {
                void message.warning("不是 JSON，无法复制格式化内容");
                return;
              }
              try {
                await navigator.clipboard.writeText(pretty.pretty ?? "");
                void message.success("已复制格式化 JSON");
              } catch (e) {
                void message.error(`复制失败：${String(e)}`);
              }
            }}
            disabled={!tryPrettyJson(valueModalRaw).ok}
          >
            复制格式化
          </Button>,
          <Button key="close" type="primary" onClick={() => setValueModalOpen(false)}>
            关闭
          </Button>
        ]}
      >
        {(() => {
          const pretty = tryPrettyJson(valueModalRaw);
          const content = pretty.ok && valueModalPrettyOpen ? pretty.pretty : valueModalRaw;
          return (
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
              {content}
            </pre>
          );
        })()}
      </Modal>
    </div>
  );
}
