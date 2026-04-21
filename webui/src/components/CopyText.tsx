import type { ReactNode } from "react";
import { Button, message } from "antd";
import type { ButtonProps } from "antd";

export type CopyTextProps = {
  text: string;
  children?: ReactNode;
  buttonProps?: Omit<ButtonProps, "onClick" | "children">;
  successMessage?: string;
};

export default function CopyText(props: CopyTextProps) {
  const { text, children, buttonProps, successMessage } = props;

  async function onCopy() {
    const t = text ?? "";
    try {
      await navigator.clipboard.writeText(t);
      void message.success(successMessage ?? "已复制到剪贴板");
    } catch (e) {
      void message.error(`复制失败：${String(e)}`);
    }
  }

  return (
    <Button {...buttonProps} onClick={() => void onCopy()}>
      {children ?? "复制"}
    </Button>
  );
}

