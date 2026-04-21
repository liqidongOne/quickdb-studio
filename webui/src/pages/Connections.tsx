import { useCallback, useMemo, useState } from "react";
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiDelete, apiPost, apiPut } from "../api/client";
import CopyText from "../components/CopyText";
import PageContainer from "../components/PageContainer";
import useConnections from "../hooks/useConnections";
import type { ConnType, Connection } from "../hooks/useConnections";
import { testMySQLConnection } from "../api/mysql";
import { testRedisConnection } from "../api/redis";

type CreateFormValues = {
  type: ConnType;
  name: string;
  mysql?: {
    host: string;
    port: number;
    username: string;
    password: string;
    defaultDatabase?: string;
  };
  redis?: {
    addr: string;
    username?: string;
    password?: string;
    db?: number;
  };
};

type EditFormValues = CreateFormValues;

const DEFAULT_FORM_VALUES: CreateFormValues = {
  type: "mysql",
  name: "",
  mysql: {
    host: "127.0.0.1",
    port: 3306,
    username: "root",
    password: "",
    defaultDatabase: ""
  },
  redis: {
    addr: "127.0.0.1:6379",
    username: "",
    password: "",
    db: 0
  }
};

function renderConfig(c: Connection) {
  // 注意：不要在表格中展示密码明文
  if (c.type === "mysql") {
    const host = c.mysql?.host ?? "";
    const port = c.mysql?.port ?? "";
    const username = c.mysql?.username ?? "";
    const db = c.mysql?.defaultDatabase ?? "";
    return `${host}:${port} user=${username}${db ? ` db=${db}` : ""}`;
  }
  const addr = c.redis?.addr ?? "";
  const db = c.redis?.db ?? 0;
  const username = c.redis?.username ?? "";
  return `${addr} db=${db}${username ? ` user=${username}` : ""}`;
}

export default function Connections() {
  const { connections, loading, error, refresh } = useConnections();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string>("");
  const [testingId, setTestingId] = useState<string>("");
  const [createForm] = Form.useForm<CreateFormValues>();
  const [editForm] = Form.useForm<EditFormValues>();
  const createType = Form.useWatch("type", createForm);
  const editType = Form.useWatch("type", editForm);

  const onTest = useCallback(
    async (c: Connection) => {
      setTestingId(c.id);
      try {
        const resp = c.type === "mysql" ? await testMySQLConnection(c.id) : await testRedisConnection(c.id);
        if (resp?.ok) {
          void message.success(`连接正常（${resp.latencyMs}ms）`);
        } else {
          void message.error("连接失败");
        }
      } catch (e) {
        void message.error(`连接失败：${String(e)}`);
      } finally {
        setTestingId("");
      }
    },
    []
  );

  const onDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await apiDelete<void>(`/api/v1/connections/${encodeURIComponent(id)}`);
        void message.success("删除成功");
        await refresh();
      } catch (e) {
        void message.error(`删除失败：${String(e)}`);
      } finally {
        setDeletingId("");
      }
    },
    [refresh]
  );

  const columns = useMemo<ColumnsType<Connection>>(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name"
      },
      {
        title: "Type",
        dataIndex: "type",
        key: "type",
        width: 120
      },
      {
        title: "Config",
        key: "config",
        render: (_, c) => (
          <Typography.Text code style={{ fontSize: 12 }}>
            {renderConfig(c)}
          </Typography.Text>
        )
      },
      {
        title: "ID",
        dataIndex: "id",
        key: "id",
        width: 320,
        render: (id: string) => (
          <Space size="small">
            <Typography.Text code style={{ fontSize: 12 }}>
              {id}
            </Typography.Text>
            <CopyText text={id} buttonProps={{ size: "small", type: "link" }}>
              复制
            </CopyText>
          </Space>
        )
      },
      {
        title: "操作",
        key: "actions",
        width: 180,
        render: (_, c) => (
          <Space size="small">
            <Button type="link" loading={testingId === c.id} onClick={() => void onTest(c)}>
              测试
            </Button>
            <Button
              type="link"
              onClick={() => {
                setEditing(c);
                // 回填：密码字段永远留空（策略：留空=不修改）
                const init: EditFormValues =
                  c.type === "mysql"
                    ? {
                        type: "mysql",
                        name: c.name,
                        mysql: {
                          host: c.mysql?.host ?? "",
                          port: c.mysql?.port ?? 3306,
                          username: c.mysql?.username ?? "",
                          password: "",
                          defaultDatabase: c.mysql?.defaultDatabase ?? ""
                        }
                      }
                    : {
                        type: "redis",
                        name: c.name,
                        redis: {
                          addr: c.redis?.addr ?? "",
                          username: c.redis?.username ?? "",
                          password: "",
                          db: c.redis?.db ?? 0
                        }
                      };
                editForm.setFieldsValue(init);
                setEditOpen(true);
              }}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除该连接？"
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => void onDelete(c.id)}
            >
              <Button type="link" danger loading={deletingId === c.id}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [deletingId, editForm, onDelete, onTest, testingId]
  );

  async function onCreate(values: CreateFormValues) {
    setSubmitting(true);
    try {
      const name = values.name?.trim() ?? "";
      const type = values.type;

      const body =
        type === "mysql"
          ? {
              name,
              type: "mysql" as const,
              mysql: {
                host: values.mysql?.host?.trim() ?? "",
                port: Number(values.mysql?.port ?? 3306),
                username: values.mysql?.username?.trim() ?? "",
                password: values.mysql?.password ?? "",
                defaultDatabase: values.mysql?.defaultDatabase?.trim() || undefined
              }
            }
          : {
              name,
              type: "redis" as const,
              redis: {
                addr: values.redis?.addr?.trim() ?? "",
                username: values.redis?.username?.trim() || undefined,
                password: values.redis?.password || undefined,
                db: Number(values.redis?.db ?? 0) || 0
              }
            };

      await apiPost<Connection>("/api/v1/connections", body);
      void message.success("创建成功");
      setCreateOpen(false);
      createForm.resetFields();
      await refresh();
    } catch (e) {
      void message.error(`创建失败：${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function onEdit(values: EditFormValues) {
    if (!editing) return;
    setSubmitting(true);
    try {
      const name = values.name?.trim() ?? "";
      const type = values.type;
      const id = editing.id;

      const body =
        type === "mysql"
          ? {
              name,
              type: "mysql" as const,
              mysql: {
                host: values.mysql?.host?.trim() ?? "",
                port: Number(values.mysql?.port ?? 3306),
                username: values.mysql?.username?.trim() ?? "",
                // 密码留空=不修改（后端会合并保留旧值）
                password: values.mysql?.password ?? "",
                defaultDatabase: values.mysql?.defaultDatabase?.trim() || undefined
              }
            }
          : {
              name,
              type: "redis" as const,
              redis: {
                addr: values.redis?.addr?.trim() ?? "",
                username: values.redis?.username?.trim() || undefined,
                // 密码留空=不修改（后端会合并保留旧值）
                password: values.redis?.password || "",
                db: Number(values.redis?.db ?? 0) || 0
              }
            };

      await apiPut<Connection>(`/api/v1/connections/${encodeURIComponent(id)}`, body);
      void message.success("保存成功");
      setEditOpen(false);
      setEditing(null);
      editForm.resetFields();
      await refresh();
    } catch (e) {
      void message.error(`保存失败：${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer
      title="Connections"
      extra={
        <Space>
          <Button onClick={() => void refresh()} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            onClick={() => {
              createForm.setFieldsValue(DEFAULT_FORM_VALUES);
              setCreateOpen(true);
            }}
          >
            新建连接
          </Button>
        </Space>
      }
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={<Typography.Text style={{ whiteSpace: "pre-wrap" }}>{error}</Typography.Text>}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      <Table<Connection> rowKey="id" loading={loading} columns={columns} dataSource={connections} />

      <Modal
        title="新建连接"
        open={createOpen}
        destroyOnClose
        okText="创建"
        cancelText="取消"
        confirmLoading={submitting}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
      >
        <Form<CreateFormValues> form={createForm} layout="vertical" initialValues={DEFAULT_FORM_VALUES} onFinish={(v) => void onCreate(v)}>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: "请选择类型" }]}>
            <Select
              options={[
                { value: "mysql", label: "mysql" },
                { value: "redis", label: "redis" }
              ]}
            />
          </Form.Item>

          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="例如：prod-mysql-ro" />
          </Form.Item>

          {createType === "redis" ? (
            <>
              <Form.Item name={["redis", "addr"]} label="addr" rules={[{ required: true, message: "请输入 addr" }]}>
                <Input placeholder="host:port" />
              </Form.Item>
              <Form.Item name={["redis", "username"]} label="username（可选）">
                <Input />
              </Form.Item>
              <Form.Item name={["redis", "password"]} label="password（可选）">
                <Input.Password />
              </Form.Item>
              <Form.Item name={["redis", "db"]} label="db（可选）">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name={["mysql", "host"]} label="host" rules={[{ required: true, message: "请输入 host" }]}>
                <Input />
              </Form.Item>
              <Form.Item name={["mysql", "port"]} label="port" rules={[{ required: true, message: "请输入 port" }]}>
                <InputNumber min={1} max={65535} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name={["mysql", "username"]} label="username" rules={[{ required: true, message: "请输入 username" }]}>
                <Input />
              </Form.Item>
              <Form.Item name={["mysql", "password"]} label="password">
                <Input.Password />
              </Form.Item>
              <Form.Item name={["mysql", "defaultDatabase"]} label="defaultDatabase（可选）">
                <Input />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title={`编辑连接${editing ? `：${editing.name}` : ""}`}
        open={editOpen}
        destroyOnClose
        okText="保存"
        cancelText="取消"
        confirmLoading={submitting}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onOk={() => editForm.submit()}
      >
        <Form<EditFormValues> form={editForm} layout="vertical" onFinish={(v) => void onEdit(v)}>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              disabled
              options={[
                { value: "mysql", label: "mysql" },
                { value: "redis", label: "redis" }
              ]}
            />
          </Form.Item>

          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input />
          </Form.Item>

          {editType === "redis" ? (
            <>
              <Form.Item name={["redis", "addr"]} label="addr" rules={[{ required: true, message: "请输入 addr" }]}>
                <Input placeholder="host:port" />
              </Form.Item>
              <Form.Item name={["redis", "username"]} label="username（可选）">
                <Input />
              </Form.Item>
              <Form.Item
                name={["redis", "password"]}
                label="password（留空=不修改）"
                extra="为安全考虑不会回填旧密码；留空保存将保留原密码。"
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item name={["redis", "db"]} label="db（可选）">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name={["mysql", "host"]} label="host" rules={[{ required: true, message: "请输入 host" }]}>
                <Input />
              </Form.Item>
              <Form.Item name={["mysql", "port"]} label="port" rules={[{ required: true, message: "请输入 port" }]}>
                <InputNumber min={1} max={65535} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name={["mysql", "username"]} label="username" rules={[{ required: true, message: "请输入 username" }]}>
                <Input />
              </Form.Item>
              <Form.Item
                name={["mysql", "password"]}
                label="password（留空=不修改）"
                extra="为安全考虑不会回填旧密码；留空保存将保留原密码。"
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item name={["mysql", "defaultDatabase"]} label="defaultDatabase（可选）">
                <Input />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </PageContainer>
  );
}
