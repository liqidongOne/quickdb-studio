import { Alert, Button, Empty, Spin, Tree, Typography } from "antd";
import type { TreeProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { isAuthError } from "../api/client";
import { getNavTree } from "../api/nav";
import { getTableMeta, listDatabases, listTables } from "../api/mysql";
import type { TreeNode, TreeNodeKind } from "./types";

export interface TreePanelProps {
  onSelect?: (node: TreeNode) => void;
  onRightClick?: (node: TreeNode, pos: { x: number; y: number }) => void;
}

type WorkspaceTreeDataNode = {
  key: string;
  title: ReactNode;
  children?: WorkspaceTreeDataNode[];
  selectable?: boolean;
  isLeaf?: boolean;
  dataRef: TreeNode;
};

function toTitleText(title: string) {
  return <span style={{ fontSize: 13 }}>{title}</span>;
}

function toErrorTitle(err: unknown) {
  return (
    <Typography.Text type="danger" style={{ fontSize: 12 }}>
      加载失败：{String(err)}
    </Typography.Text>
  );
}

function updateTree(nodes: WorkspaceTreeDataNode[], key: string, patch: Partial<WorkspaceTreeDataNode> & { dataRef?: TreeNode }): WorkspaceTreeDataNode[] {
  return nodes.map((n) => {
    if (n.key === key) {
      return {
        ...n,
        ...patch,
        dataRef: patch.dataRef ?? n.dataRef
      };
    }
    if (n.children && n.children.length > 0) {
      return { ...n, children: updateTree(n.children, key, patch) };
    }
    return n;
  });
}

function buildNode(dataRef: TreeNode, opts?: Partial<Omit<WorkspaceTreeDataNode, "key" | "dataRef" | "title">> & { titleNode?: ReactNode }) {
  return {
    key: dataRef.id,
    title: opts?.titleNode ?? toTitleText(dataRef.title),
    dataRef,
    children: opts?.children,
    selectable: opts?.selectable,
    isLeaf: opts?.isLeaf
  } satisfies WorkspaceTreeDataNode;
}

export default function TreePanel(props: TreePanelProps) {
  const [treeData, setTreeData] = useState<WorkspaceTreeDataNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ kind: "auth" | "generic"; message: string } | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getNavTree();

      const mysqlChildren: WorkspaceTreeDataNode[] =
        data.mysql?.map((c) => {
          const n: TreeNode = {
            id: `mysql_conn:${c.id}`,
            kind: "mysql_conn",
            title: c.name || c.id,
            meta: { connId: c.id, connName: c.name }
          };
          return buildNode(n, { selectable: true, isLeaf: false });
        }) ?? [];

      const redisChildren: WorkspaceTreeDataNode[] =
        data.redis?.map((c) => {
          const n: TreeNode = {
            id: `redis_conn:${c.id}`,
            kind: "redis_conn",
            title: c.name || c.id,
            meta: { connId: c.id, connName: c.name }
          };
          return buildNode(n, { selectable: true, isLeaf: false });
        }) ?? [];

      if (mysqlChildren.length === 0) {
        mysqlChildren.push(
          buildNode(
            { id: "mysql_conn:empty", kind: "mysql_conn", title: "暂无 MySQL 连接", meta: { placeholder: true } },
            { selectable: false, isLeaf: true, titleNode: <Typography.Text type="secondary">暂无 MySQL 连接（请先去 Connections 创建）</Typography.Text> }
          )
        );
      }
      if (redisChildren.length === 0) {
        redisChildren.push(
          buildNode(
            { id: "redis_conn:empty", kind: "redis_conn", title: "暂无 Redis 连接", meta: { placeholder: true } },
            { selectable: false, isLeaf: true, titleNode: <Typography.Text type="secondary">暂无 Redis 连接（请先去 Connections 创建）</Typography.Text> }
          )
        );
      }

      const root: WorkspaceTreeDataNode[] = [
        buildNode({ id: "group_mysql", kind: "group_mysql", title: "MySQL" }, { selectable: false, children: mysqlChildren }),
        buildNode({ id: "group_redis", kind: "group_redis", title: "Redis" }, { selectable: false, children: redisChildren })
      ];
      setTreeData(root);
    } catch (e) {
      setTreeData([]);
      if (isAuthError(e)) {
        setError({ kind: "auth", message: "Token 未设置或已失效。请在顶部输入并保存 Token，然后点击重试。" });
      } else {
        setError({ kind: "generic", message: String(e) });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSelect: TreeProps["onSelect"] = (_selectedKeys, info) => {
    // antd Tree 的 node 类型较复杂，这里只取出我们挂载的 dataRef
    const dataRef = (info.node as unknown as { dataRef?: TreeNode }).dataRef;
    if (dataRef) props.onSelect?.(dataRef);
  };

  const onRightClick: TreeProps["onRightClick"] = (info) => {
    // 右键仅用于快速操作（例如“新建查询”）
    try {
      (info.event as unknown as MouseEvent).preventDefault?.();
    } catch {
      // ignore
    }
    const dataRef = (info.node as unknown as { dataRef?: TreeNode }).dataRef;
    const ev = info.event as unknown as { clientX?: number; clientY?: number };
    const x = Number(ev?.clientX ?? 0) || 0;
    const y = Number(ev?.clientY ?? 0) || 0;
    if (dataRef) props.onRightClick?.(dataRef, { x, y });
  };

  const loadData = useCallback(async (antdNode: unknown) => {
      const node = (antdNode as unknown as { key?: string; children?: unknown; dataRef?: TreeNode }).dataRef;
      const key = String((antdNode as any).key ?? node?.id ?? "");
      if (!node || !key) return;

      // 已加载过 children（即使为空数组）时不重复加载
      if (Array.isArray((antdNode as any).children)) return;

      const kind: TreeNodeKind = node.kind;
      if (kind === "mysql_conn") {
        const connId = String((node.meta as any)?.connId ?? "");
        const connName = String((node.meta as any)?.connName ?? "");
        try {
          const dbs = await listDatabases(connId);
          const children = (dbs.length ? dbs : [""]).map((db) =>
            buildNode(
              {
                id: db ? `mysql_db:${connId}:${db}` : `mysql_db:${connId}:empty`,
                kind: "mysql_db",
                title: db || "暂无数据库",
                meta: { connId, connName, db, placeholder: !db }
              },
              db
                ? { selectable: true, isLeaf: false }
                : { selectable: false, isLeaf: true, titleNode: <Typography.Text type="secondary">暂无数据库</Typography.Text> }
            )
          );
          setTreeData((prev) => updateTree(prev, key, { children }));
        } catch (e) {
          const errNode = buildNode(
            { id: `${key}:error`, kind: "mysql_db", title: "加载失败", meta: { error: String(e) } },
            { selectable: false, isLeaf: true, titleNode: toErrorTitle(e) }
          );
          setTreeData((prev) => updateTree(prev, key, { children: [errNode] }));
        }
        return;
      }

      if (kind === "mysql_db") {
        const connId = String((node.meta as any)?.connId ?? "");
        const connName = String((node.meta as any)?.connName ?? "");
        const db = String((node.meta as any)?.db ?? "");
        try {
          const tables = await listTables(connId, db);
          const children = (tables.length ? tables : [""]).map((t) =>
            buildNode(
              {
                id: t ? `mysql_table:${connId}:${db}:${t}` : `mysql_table:${connId}:${db}:empty`,
                kind: "mysql_table",
                title: t || "暂无表",
                meta: { connId, connName, db, table: t, placeholder: !t }
              },
              t ? { selectable: true, isLeaf: false } : { selectable: false, isLeaf: true, titleNode: <Typography.Text type="secondary">暂无表</Typography.Text> }
            )
          );
          setTreeData((prev) => updateTree(prev, key, { children }));
        } catch (e) {
          const errNode = buildNode(
            { id: `${key}:error`, kind: "mysql_table", title: "加载失败", meta: { error: String(e) } },
            { selectable: false, isLeaf: true, titleNode: toErrorTitle(e) }
          );
          setTreeData((prev) => updateTree(prev, key, { children: [errNode] }));
        }
        return;
      }

      if (kind === "mysql_table") {
        const connId = String((node.meta as any)?.connId ?? "");
        const connName = String((node.meta as any)?.connName ?? "");
        const db = String((node.meta as any)?.db ?? "");
        const table = String((node.meta as any)?.table ?? "");
        try {
          const meta = await getTableMeta(connId, db, table);
          const colsCount = Array.isArray((meta as any)?.columns) ? (meta as any).columns.length : 0;
          const idxCount = Array.isArray((meta as any)?.indexes) ? (meta as any).indexes.length : 0;

          const columnsLeaf = buildNode(
            {
              id: `${key}:columns`,
              kind: "mysql_table",
              title: "Columns",
              meta: { connId, connName, db, table, leaf: "columns" }
            },
            { selectable: true, isLeaf: true, titleNode: toTitleText(`Columns (${colsCount})`) }
          );
          const indexesLeaf = buildNode(
            {
              id: `${key}:indexes`,
              kind: "mysql_table",
              title: "Indexes",
              meta: { connId, connName, db, table, leaf: "indexes" }
            },
            { selectable: true, isLeaf: true, titleNode: toTitleText(`Indexes (${idxCount})`) }
          );

          setTreeData((prev) =>
            updateTree(prev, key, {
              dataRef: { ...node, meta: { ...(node.meta as any), connName, tableMeta: meta } },
              children: [columnsLeaf, indexesLeaf]
            })
          );
        } catch (e) {
          const errNode = buildNode(
            { id: `${key}:error`, kind: "mysql_table", title: "加载失败", meta: { error: String(e) } },
            { selectable: false, isLeaf: true, titleNode: toErrorTitle(e) }
          );
          setTreeData((prev) => updateTree(prev, key, { children: [errNode] }));
        }
        return;
      }

      if (kind === "redis_conn") {
        const connId = String((node.meta as any)?.connId ?? "");
        const connName = String((node.meta as any)?.connName ?? "");
        const keysNode = buildNode(
          {
            id: `redis_keys_root:${connId}`,
            kind: "redis_keys_root",
            title: "Keys",
            meta: { connId, connName }
          },
          { selectable: true, isLeaf: true }
        );
        setTreeData((prev) => updateTree(prev, key, { children: [keysNode] }));
        return;
      }
  }, []);

  const defaultExpandedKeys = useMemo(() => ["group_mysql", "group_redis"], []);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginTop: 8 }}>
        {error?.kind === "auth" ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <div style={{ fontWeight: 600 }}>需要设置 Token</div>
                <div style={{ marginTop: 6 }}>
                  <Typography.Text type="secondary">{error.message}</Typography.Text>
                </div>
              </div>
            }
          >
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Button
                onClick={() => {
                  const el = document.getElementById("solo-token-input") as HTMLInputElement | null;
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  el?.focus();
                }}
              >
                去设置 Token
              </Button>
              <Button type="primary" onClick={() => void refresh()} loading={loading}>
                重试
              </Button>
            </div>
          </Empty>
        ) : (
          <>
            {error?.kind === "generic" ? (
              <Alert
                type="error"
                showIcon
                message="加载导航树失败"
                description={<pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{error.message}</pre>}
                action={
                  <Button size="small" onClick={() => void refresh()} loading={loading}>
                    重试
                  </Button>
                }
                style={{ marginBottom: 8 }}
              />
            ) : null}

            <Spin spinning={loading}>
              <Tree
                showLine
                treeData={treeData as unknown as any[]}
                onSelect={onSelect}
                onRightClick={onRightClick}
                loadData={loadData}
                defaultExpandedKeys={defaultExpandedKeys}
              />
            </Spin>
          </>
        )}
      </div>
    </div>
  );
}
