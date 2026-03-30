import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

interface LoginDialogProps {
  title?: string;
  logo?: string;
  open?: boolean;
  onLogin: () => void;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export function LoginDialog({
  title,
  logo,
  open = false,
  onLogin,
  onOpenChange,
  onClose,
}: LoginDialogProps) {
  const [internalOpen, setInternalOpen] = useState(open);

  useEffect(() => {
    if (!onOpenChange) {
      setInternalOpen(open);
    }
  }, [open, onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      onClose?.();
    }
  };

  return (
    <Dialog
      open={onOpenChange ? open : internalOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="py-5 rounded-[20px] w-[400px] shadow-[0px_4px_11px_0px_rgba(0,0,0,0.08)] backdrop-blur-2xl p-0 gap-0 text-center" style={{ background: "var(--popover)", borderColor: "var(--border)" }}>
        <div className="flex flex-col items-center gap-2 p-5 pt-12">
          {logo ? (
            <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <img src={logo} alt="Dialog graphic" className="w-10 h-10 rounded-md" />
            </div>
          ) : null}

          {/* Title and subtitle */}
          {title ? (
            <DialogTitle className="text-xl font-semibold leading-[26px] tracking-[-0.44px]" style={{ color: "var(--popover-foreground)" }}>
              {title}
            </DialogTitle>
          ) : null}
          <DialogDescription className="text-sm leading-5 tracking-[-0.154px]" style={{ color: "var(--muted-foreground)" }}>
            请登录后继续
          </DialogDescription>
        </div>

        <DialogFooter className="px-5 py-5">
          {/* Login button */}
          <Button
            onClick={onLogin}
            className="w-full h-10 rounded-[10px] text-sm font-medium leading-5 tracking-[-0.154px]"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            登录
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
