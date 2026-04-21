import type { WorkspaceTab } from "./types";

export interface TabsState {
  tabs: WorkspaceTab[];
  activeId: string;
}

/**
 * 简单稳定 hash（djb2），用于生成 tab 的稳定 id。
 * 不引入额外依赖，且同输入在同版本代码下恒定。
 */
export function stableId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // >>> 0 转为 uint32，避免负数
  return `t_${(hash >>> 0).toString(36)}`;
}

export function tabIdOf(tab: Pick<WorkspaceTab, "kind" | "key">): string {
  return stableId(`${tab.kind}:${tab.key}`);
}

// WorkspaceTab 为 discriminated union；这里用泛型避免 spread 后类型被“抹平”导致无法赋值回 WorkspaceTab。
export function openOrFocusTab<T extends Omit<WorkspaceTab, "id">>(state: TabsState, tab: T & { id?: string }): TabsState {
  const id = tab.id ?? tabIdOf(tab);
  const existingIndex = state.tabs.findIndex((t) => t.id === id);
  if (existingIndex >= 0) {
    return { ...state, activeId: id };
  }
  const nextTab = { ...(tab as any), id } as WorkspaceTab;
  return { tabs: [...state.tabs, nextTab], activeId: id };
}

export function closeTab(state: TabsState, tabId: string): TabsState {
  const idx = state.tabs.findIndex((t) => t.id === tabId);
  if (idx < 0) return state;

  const nextTabs = state.tabs.filter((t) => t.id !== tabId);
  if (state.activeId !== tabId) {
    return { ...state, tabs: nextTabs };
  }

  // 关闭当前 tab：优先激活左侧，否则右侧，否则空
  const fallback = nextTabs[idx - 1] ?? nextTabs[idx] ?? nextTabs[nextTabs.length - 1];
  return { tabs: nextTabs, activeId: fallback?.id ?? "" };
}

export function updateTab(state: TabsState, tabId: string, patch: Partial<Omit<WorkspaceTab, "id">>): TabsState {
  const idx = state.tabs.findIndex((t) => t.id === tabId);
  if (idx < 0) return state;
  const nextTabs = state.tabs.slice();
  nextTabs[idx] = { ...(nextTabs[idx] as any), ...(patch as any) } as WorkspaceTab;
  return { ...state, tabs: nextTabs };
}
