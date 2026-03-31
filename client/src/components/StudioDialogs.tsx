/*
 * StudioDialogs.tsx - 将页面包装为对话框
 * 用于在 Studio 页面中以对话框形式打开设置、偏好、用户中心
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Profile from "@/pages/Profile";
import { SettingsDialog } from "./SettingsDialog";

export type DialogType = "settings" | "profile" | null;

interface StudioDialogsProps {
  open: DialogType;
  onClose: () => void;
}

export function StudioDialogs({ open, onClose }: StudioDialogsProps) {
  return (
    <>
      {/* 设置对话框 - 使用新的独立组件 */}
      <SettingsDialog open={open === "settings"} onClose={onClose} />

      {/* 用户中心对话框 */}
      <Dialog
        open={open === "profile"}
        onOpenChange={isOpen => !isOpen && onClose()}
      >
        <DialogContent className="max-w-2xl h-[50vh] bg-card">
          <Profile embedded={true} onSaved={onClose} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// 账号绑定对话框
export function AccountBindingDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle>账号绑定</DialogTitle>
        </DialogHeader>
        <div className="py-8 text-center">
          <p className="text-muted-foreground mb-4">
            账号绑定功能正在开发中...
          </p>
          <p className="text-sm text-muted-foreground/60">
            即将支持 GitHub、Google、微信、抖音 账号绑定
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
