import { apiGet, apiPost } from "./client";

export type RedisKeysSearchReq = {
  pattern: string;
  cursor: string;
  count: number;
};

export type RedisKeysSearchResp = {
  keys: string[];
  nextCursor: string;
};

export async function keysSearch(connId: string, req: RedisKeysSearchReq): Promise<RedisKeysSearchResp> {
  const id = connId.trim();
  if (!id) {
    return { keys: [], nextCursor: "0" };
  }
  return apiPost<RedisKeysSearchResp>(`/api/v1/redis/${encodeURIComponent(id)}/keys/search`, req);
}

export type RedisKeyPreviewResp = {
  key: string;
  type: string;
  ttlMs: number;
  data?: unknown;
};

export async function keyPreview(
  connId: string,
  params: { key: string; cursor?: string; count?: number; start?: number; stop?: number }
): Promise<RedisKeyPreviewResp> {
  const id = connId.trim();
  const key = params.key.trim();
  const qs = new URLSearchParams({ key });
  if (params.cursor !== undefined) qs.set("cursor", String(params.cursor));
  if (params.count !== undefined) qs.set("count", String(params.count));
  if (params.start !== undefined) qs.set("start", String(params.start));
  if (params.stop !== undefined) qs.set("stop", String(params.stop));
  return apiGet<RedisKeyPreviewResp>(`/api/v1/redis/${encodeURIComponent(id)}/key/preview?${qs.toString()}`);
}

export type TestConnResp = { ok: boolean; latencyMs: number };

export async function testRedisConnection(connId: string): Promise<TestConnResp> {
  const id = connId.trim();
  return apiPost<TestConnResp>(`/api/v1/redis/${encodeURIComponent(id)}/test`, {});
}
