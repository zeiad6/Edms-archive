"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/format";

const POPOVER_OPEN_EVENT = "edms:popover-opened";

interface PopoverContextValue {
  id: string;
  open: boolean;
  setOpen: (next: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error("Popover components must be used within <Popover>");
  return ctx;
}

export function Popover({
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
      if (next && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(POPOVER_OPEN_EVENT, { detail: { id } }));
      }
    },
    [id, isControlled, onOpenChange],
  );

  // Close automatically when another Popover opens anywhere in the page
  useEffect(() => {
    if (!open) return;
    const onOtherOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (detail?.id && detail.id !== id) {
        setOpen(false);
      }
    };
    window.addEventListener(POPOVER_OPEN_EVENT, onOtherOpen);
    return () => window.removeEventListener(POPOVER_OPEN_EVENT, onOtherOpen);
  }, [id, open, setOpen]);

  return (
    <PopoverContext.Provider value={{ id, open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  asChild = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { open, setOpen, triggerRef } = usePopoverContext();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      type={asChild ? undefined : "button"}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) {
          setOpen(!open);
        }
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  collisionPadding = 12,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
  collisionPadding?: number;
}) {
  const { open, setOpen, triggerRef } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [flipUp, setFlipUp] = useState(false);

  // Collision-aware positioning: opens downward by default (`top-full`), only
  // flips if there is not enough viewport space below + collisionPadding.
  useLayoutEffect(() => {
    if (!open || !contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 800;
    if (rect.bottom + collisionPadding > viewportHeight && rect.top > rect.height + collisionPadding) {
      setFlipUp(true);
    } else {
      setFlipUp(false);
    }
  }, [open, collisionPadding]);

  // Dismiss on Escape or outside click
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (contentRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      role="dialog"
      data-side={flipUp ? "top" : "bottom"}
      style={{
        marginTop: flipUp ? undefined : `${sideOffset}px`,
        marginBottom: flipUp ? `${sideOffset}px` : undefined,
      }}
      className={cn(
        "surface-pop absolute z-50 animate-pop rounded-2xl border border-border bg-card text-foreground shadow-pop outline-none",
        flipUp ? "bottom-full" : "top-full",
        align === "start" && "start-0",
        align === "end" && "end-0",
        align === "center" && "start-1/2 -translate-x-1/2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
