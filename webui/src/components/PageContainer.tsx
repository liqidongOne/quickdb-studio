import type { ReactNode } from "react";
import { Card, Typography } from "antd";
import type { CardProps } from "antd";

export type PageContainerProps = {
  title?: ReactNode;
  extra?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
} & Omit<CardProps, "title" | "extra" | "children">;

export default function PageContainer(props: PageContainerProps) {
  const { title, extra, description, children, ...cardProps } = props;

  return (
    <Card title={title} extra={extra} {...cardProps}>
      {description ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {description}
        </Typography.Paragraph>
      ) : null}
      {children}
    </Card>
  );
}

