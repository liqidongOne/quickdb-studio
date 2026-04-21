import { useCallback, useMemo, useState } from "react";
import { Button, ConfigProvider, Dropdown, Layout, Tabs, Typography, message, theme } from "antd";
import type { TabsProps } from "antd";
import TreePanel from "./TreePanel";
import type { MysqlDataTabPayload, MysqlQueryTabPayload, MysqlSchemaTabPayload, RedisKeyTabPayload, RedisKeysTabPayload, TreeNode, WorkspaceTab } from "./types";
import { closeTab, openOrFocusTab, stableId, tabIdOf, updateTab, type TabsState } from "./state";
import MysqlQueryTab from "./tabs/MysqlQueryTab";
import MysqlDataTab from "./tabs/MysqlDataTab";
import MysqlSchemaTab from "./tabs/MysqlSchemaTab";
import RedisKeysTab from "./tabs/RedisKeysTab";
import RedisKeyTab from "./tabs/RedisKeyTab";

const welcomeTab: WorkspaceTab = {
  id: stableId("welcome"),
  kind: "welcome",
  key: "welcome",
  title: "欢迎",
  closable: false
};

export default function Workspace() {
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [siderWidth, setSiderWidth] = useState<number>(() => {
    try {
      const KEY = "quickdb_workspace_sider_width";
      const OLD_KEY = "solo_workspace_sider_width";
      const v = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
      const n = v ? Number(v) : 280;
      return Number.isFinite(n) ? Math.min(520, Math.max(220, n)) : 280;
    } catch {
      return 280;
    }
  });

  const [tabsState, setTabsState] = useState<TabsState>(() => ({
    tabs: [welcomeTab],
    activeId: welcomeTab.id
  }));

  const [ctxMenu, setCtxMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    table?: { connId: string; connName: string; db: string; table: string };
  }>({ open: false, x: 0, y: 0 });

  const renderTabContent = useCallback(
    (tab: WorkspaceTab) => {
      if (tab.kind === "welcome") {
        return (
          <div style={{ padding: 12 }}>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              欢迎来到 Workspace
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              左侧树支持 MySQL/Redis 浏览；MySQL：左键表=Data，右键表=菜单；Redis：Keys 搜索支持最近 pattern 与高亮，Value 支持 JSON 格式化。
            </Typography.Paragraph>
          </div>
        );
      }

      if (tab.kind === "mysql_query") {
        const p = tab.payload;
        return (
          <MysqlQueryTab
            connId={p.connId}
            connName={p.connName ?? ""}
            db={p.db}
            table={p.table}
            initialSql={p.initialSql}
          />
        );
      }

      if (tab.kind === "mysql_data") {
        const p = tab.payload;
        return <MysqlDataTab connId={p.connId} connName={p.connName ?? ""} db={p.db} table={p.table} limit={p.limit} />;
      }

      if (tab.kind === "mysql_schema") {
        const p = tab.payload;
        return (
          <MysqlSchemaTab
            connId={p.connId}
            connName={p.connName ?? ""}
            db={p.db}
            table={p.table}
            defaultActive={p.defaultActive}
          />
        );
      }

      if (tab.kind === "redis_keys") {
        const p = tab.payload;
        return (
          <RedisKeysTab
            connId={p.connId}
            connName={p.connName ?? ""}
            onOpenKey={(key) => {
              const connIdStr = p.connId;
              const connNameStr = p.connName ?? "";
              const payload: RedisKeyTabPayload = { connId: connIdStr, connName: connNameStr, key };
              // 注意：按需求指定 tab.id（而不是 stableId），避免 key 中特殊字符导致多次打开。
              const tabId = `redis:${connIdStr}:${key}`;
              setTabsState((s) => {
                const tabInput = { id: tabId, kind: "redis_key" as const, key: `${connIdStr}:${key}`, title: key, closable: true, payload };
                const next = openOrFocusTab(s, tabInput);
                // 若已存在：刷新 payload/title（例如 connName 变化）
                return updateTab(next, tabId, { title: key, payload });
              });
            }}
          />
        );
      }

      if (tab.kind === "redis_key") {
        const p = tab.payload;
        return <RedisKeyTab connId={p.connId} connName={p.connName ?? ""} redisKey={p.key} />;
      }

      return (
        <div style={{ padding: 12 }}>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {tab.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            kind={tab.kind}，key={tab.key}（占位）
          </Typography.Paragraph>
        </div>
      );
    },
    [setTabsState]
  );

  const items = useMemo(() => {
    return tabsState.tabs.map((t) => {
      const closable = t.closable ?? true;
      return {
        key: t.id,
        label: t.title,
        closable,
        children: renderTabContent(t)
      };
    }) satisfies TabsProps["items"];
  }, [renderTabContent, tabsState.tabs]);

  const onTreeSelect = (node: TreeNode) => {
    // 优先处理 mysql_table 的叶子节点：Columns/Indexes -> Schema Tab
    if (node.kind === "mysql_table" && (node.id.endsWith(":columns") || node.id.endsWith(":indexes"))) {
      // 优先从 meta 取（TreePanel 已填充），否则回退从 id 解析
      let connId = String((node.meta as any)?.connId ?? "");
      let connName = String((node.meta as any)?.connName ?? "");
      let db = String((node.meta as any)?.db ?? "");
      let table = String((node.meta as any)?.table ?? "");
      let leaf = String((node.meta as any)?.leaf ?? "") as "columns" | "indexes";

      if (!connId || !db || !table || (leaf !== "columns" && leaf !== "indexes")) {
        const parts = node.id.split(":");
        // mysql_table:<connId>:<db>:<table>:(columns|indexes)
        if (parts.length >= 5) {
          connId = parts[1] ?? "";
          db = parts[2] ?? "";
          table = parts.slice(3, parts.length - 1).join(":"); // 兼容 table 名里出现冒号（极少见）
          leaf = parts[parts.length - 1] as "columns" | "indexes";
        }
      }

      if (connId && db && table && (leaf === "columns" || leaf === "indexes")) {
        const schemaKey = `mysql_schema::${connId}::${db}::${table}`;
        const title = `${connName || connId} / ${db}.${table} (Schema)`;
        const payload: MysqlSchemaTabPayload = { connId, connName, db, table, defaultActive: leaf };

        setTabsState((s) => {
          const tabInput = { kind: "mysql_schema" as const, key: schemaKey, title, closable: true, payload };
          let next = openOrFocusTab(s, tabInput);
          const id = tabIdOf(tabInput);
          next = updateTab(next, id, { title, payload });
          return { ...next, activeId: id };
        });
        return;
      }
    }

    // 当前阶段只做占位：点树节点 -> 打开/聚焦对应 tab
    // 按 spec 的交互习惯：点击 table -> 打开 MySQL Query；点击 Keys -> 打开 Redis Keys。
    // （当前任务不实现 Tab 内容，只保证能打开/聚焦，避免类型报错。）
    if (node.kind === "mysql_table") {
      const connName = String((node.meta as any)?.connName ?? "");
      const connId = String((node.meta as any)?.connId ?? "");
      const db = String((node.meta as any)?.db ?? "");
      const table = String((node.meta as any)?.table ?? "");

      setTabsState((s) => {
        // 左键点击：只打开 Data Tab（按表唯一）
        const dataKey = `mysql_data::${connId}::${db}::${table}`;
        const dataTitle = `${connName || connId} / ${db}.${table} (Data)`;
        const dataPayload: MysqlDataTabPayload = { connId, connName, db, table, limit: 200 };
        const dataTabInput = { kind: "mysql_data" as const, key: dataKey, title: dataTitle, closable: true, payload: dataPayload };
        let next = openOrFocusTab(s, dataTabInput);
        const dataId = tabIdOf(dataTabInput);
        next = updateTab(next, dataId, { title: dataTitle, payload: dataPayload });

        // 让 Data Tab 成为当前激活（点击表=看数据）
        return { ...next, activeId: dataId };
      });
      return;
    }
    if (node.kind === "redis_keys_root") {
      const connName = String((node.meta as any)?.connName ?? "");
      const connId = String((node.meta as any)?.connId ?? "");
      const payload: RedisKeysTabPayload = { connId, connName };
      setTabsState((s) =>
        openOrFocusTab(s, {
          kind: "redis_keys",
          key: connId || node.id,
          title: `Redis ${connName || connId} Keys`,
          closable: true,
          payload
        })
      );
      return;
    }

    // 其他节点：暂时统一打开一个占位 tab（后续可按 kind/payload 细分）
    setTabsState((s) =>
      openOrFocusTab(s, {
        kind: node.kind,
        key: node.id,
        title: node.title,
        closable: true,
        payload: node
      })
    );
  };

  function qId(s: string) {
    // MySQL 标识符转义（反引号）
    return "`" + s.replace(/`/g, "``") + "`";
  }

  const openNewQueryTab = useCallback(
    (opts: { connId: string; connName: string; db: string; table: string; sql: string; titleSuffix: string }) => {
      const { connId, connName, db, table, sql, titleSuffix } = opts;
      const payload: MysqlQueryTabPayload = { connId, connName, db, table, initialSql: sql };
      const nonce = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const tabKey = `mysql_query_custom::${connId}::${db}::${table}::${nonce}`;
      const title = `${connName || connId} / ${db}.${table} (${titleSuffix})`;
      const id = stableId(tabKey);
      setTabsState((s) => {
        const tabInput = { id, kind: "mysql_query" as const, key: tabKey, title, closable: true, payload };
        const next = openOrFocusTab(s, tabInput);
        return { ...updateTab(next, id, { title, payload }), activeId: id };
      });
    },
    []
  );

  const onTreeRightClickWithPos = useCallback(
    (node: TreeNode, pos: { x: number; y: number }) => {
      if (node.kind !== "mysql_table") return;
      // 只对“表节点”（非 columns/indexes leaf）出菜单
      if (node.id.endsWith(":columns") || node.id.endsWith(":indexes")) return;

      const connName = String((node.meta as any)?.connName ?? "");
      const connId = String((node.meta as any)?.connId ?? "");
      const db = String((node.meta as any)?.db ?? "");
      const table = String((node.meta as any)?.table ?? "");
      if (!connId || !db || !table) return;

      setCtxMenu({ open: true, x: pos.x, y: pos.y, table: { connId, connName, db, table } });
    },
    []
  );

  const onEdit: TabsProps["onEdit"] = (targetKey, action) => {
    if (action !== "remove") return;
    const tabId = String(targetKey);
    const tab = tabsState.tabs.find((t) => t.id === tabId);
    if (tab && tab.closable === false) return;
    setTabsState((s) => closeTab(s, tabId));
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#4f8cff",
          colorBgContainer: "#111823",
          colorBgElevated: "#151f2c",
          colorBorderSecondary: "rgba(255,255,255,0.10)",
          colorText: "rgba(255,255,255,0.92)",
          colorTextSecondary: "rgba(255,255,255,0.62)"
        }
      }}
    >
      <Layout className="solo-workspace" style={{ height: "100%" }}>
        {/* 右键菜单（表节点） */}
        {ctxMenu.open && ctxMenu.table ? (
          <Dropdown
            open={ctxMenu.open}
            placement="bottomLeft"
            trigger={["click"]}
            onOpenChange={(open) => setCtxMenu((s) => ({ ...s, open }))}
            getPopupContainer={() => document.body}
            menu={{
              items: [
                { key: "new_query", label: "新建查询" },
                { key: "copy_name", label: "复制表名" },
                { key: "select_tpl", label: "生成 SELECT 模板" },
                { key: "count", label: "Count(*)" },
                { key: "describe", label: "Describe" }
              ],
              onClick: async ({ key }) => {
                const t = ctxMenu.table;
                setCtxMenu((s) => ({ ...s, open: false }));
                if (!t) return;

                const fullName = `${t.db}.${t.table}`;
                if (key === "copy_name") {
                  try {
                    await navigator.clipboard.writeText(fullName);
                    void message.success("已复制表名");
                  } catch (e) {
                    void message.error(`复制失败：${String(e)}`);
                  }
                  return;
                }

                const dbQ = qId(t.db);
                const tbQ = qId(t.table);
                const sql =
                  key === "count"
                    ? `SELECT COUNT(*) AS cnt FROM ${dbQ}.${tbQ};`
                    : key === "describe"
                      ? `DESCRIBE ${dbQ}.${tbQ};`
                      : key === "select_tpl"
                        ? `SELECT * FROM ${dbQ}.${tbQ} WHERE 1=1 LIMIT 200;`
                        : `SELECT * FROM ${dbQ}.${tbQ} LIMIT 200;`;

                openNewQueryTab({
                  connId: t.connId,
                  connName: t.connName,
                  db: t.db,
                  table: t.table,
                  sql,
                  titleSuffix: "Query"
                });
              }
            }}
          >
            <span style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, width: 1, height: 1, zIndex: 9999 }} />
          </Dropdown>
        ) : null}

        <Layout.Sider
          width={siderWidth}
          collapsed={siderCollapsed}
          collapsedWidth={56}
          trigger={null}
          style={{ borderRight: "1px solid rgba(255,255,255,0.10)", background: "rgba(17,24,35,0.65)", position: "relative" }}
        >
          <div style={{ padding: 10 }}>
            <div className="solo-panel" style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Typography.Text strong style={{ color: "rgba(255,255,255,0.9)" }}>
                  {siderCollapsed ? "WS" : "Workspace"}
                </Typography.Text>
                <Button size="small" onClick={() => setSiderCollapsed((v) => !v)}>
                  {siderCollapsed ? ">" : "<"}
                </Button>
              </div>
            </div>
          </div>
          <div style={{ padding: 10, paddingTop: 0 }}>
            <div className="solo-panel" style={{ padding: 10, height: "calc(100vh - 240px)", overflow: "auto" }}>
              <TreePanel onSelect={onTreeSelect} onRightClick={onTreeRightClickWithPos} />
            </div>
          </div>

          {/* 拖拽调宽：仅展开状态可用 */}
          {!siderCollapsed ? (
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = siderWidth;
                const onMove = (ev: MouseEvent) => {
                  const next = Math.min(520, Math.max(220, startW + (ev.clientX - startX)));
                  setSiderWidth(next);
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                  try {
                    localStorage.setItem("quickdb_workspace_sider_width", String(siderWidth));
                    localStorage.removeItem("solo_workspace_sider_width");
                  } catch {
                    // ignore
                  }
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: 6,
                height: "100%",
                cursor: "col-resize",
                background: "transparent"
              }}
              title="拖拽调整宽度"
            />
          ) : null}
        </Layout.Sider>

        <Layout.Content style={{ background: "transparent", padding: 10 }}>
          <div className="solo-panel" style={{ height: "calc(100vh - 200px)", overflow: "hidden" }}>
            <Tabs
              type="editable-card"
              hideAdd
              items={items}
              activeKey={tabsState.activeId}
              onChange={(k) => setTabsState((s) => ({ ...s, activeId: k }))}
              onEdit={onEdit}
            />
          </div>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
