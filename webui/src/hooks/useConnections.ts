import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";

export type ConnType = "mysql" | "redis";

export type MySQLConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  defaultDatabase?: string;
  sslEnabled?: boolean;
};

export type RedisConfig = {
  addr: string; // host:port
  username?: string;
  password?: string;
  db?: number;
  tlsEnabled?: boolean;
};

// 与现有页面 Connections.tsx 中的 Connection model 对齐（id/type/name/mysql/redis）
export type Connection = {
  id: string;
  type: ConnType;
  name: string;
  createdAt: number;
  updatedAt: number;
  mysql?: MySQLConfig;
  redis?: RedisConfig;
};

function isMysqlConn(c: Connection): c is Connection & { type: "mysql"; mysql: MySQLConfig } {
  return c.type === "mysql" && !!c.mysql;
}

function isRedisConn(c: Connection): c is Connection & { type: "redis"; redis: RedisConfig } {
  return c.type === "redis" && !!c.redis;
}

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await apiGet<Connection[]>("/api/v1/connections");
      setConnections(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mysqlConnections = useMemo(() => connections.filter(isMysqlConn), [connections]);
  const redisConnections = useMemo(() => connections.filter(isRedisConn), [connections]);

  return {
    connections,
    mysqlConnections,
    redisConnections,
    loading,
    error,
    refresh
  };
}

export default useConnections;
