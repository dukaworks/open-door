/*
 * StudioDialogs.tsx - 将页面包装为对话框
 * 用于在 Studio 页面中以对话框形式打开设置、偏好、用户中心
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Preferences from "@/pages/Preferences";

export type DialogType = "settings" | "profile" | "preferences" | null;

interface StudioDialogsProps {
  open: DialogType;
  onClose: () => void;
}

export function StudioDialogs({ open, onClose }: StudioDialogsProps) {
  return (
    <>
      {/* 设置对话框 */}
      <Dialog open={open === "settings"} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>设置</DialogTitle>
          </DialogHeader>
          <Settings />
        </DialogContent>
      </Dialog>

      {/* 用户中心对话框 */}
      <Dialog open={open === "profile"} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>用户中心</DialogTitle>
          </DialogHeader>
          <Profile />
        </DialogContent>
      </Dialog>

      {/* 偏好设置对话框 */}
      <Dialog open={open === "preferences"} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>偏好设置</DialogTitle>
          </DialogHeader>
          <Preferences />
        </DialogContent>
      </Dialog>
    </>
  );
}

// 账号绑定对话框（复用设置页面）
export function AccountBindingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
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
