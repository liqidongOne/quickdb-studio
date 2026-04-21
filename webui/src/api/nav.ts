import { apiGet } from "./client";

export type NavConn = {
  id: string;
  name: string;
  type: "mysql" | "redis";
};

export type NavTreeResp = {
  mysql: NavConn[];
  redis: NavConn[];
};

export async function getNavTree(): Promise<NavTreeResp> {
  return apiGet<NavTreeResp>("/api/v1/nav/tree");
}

