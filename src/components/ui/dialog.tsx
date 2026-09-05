"use client";
import { t } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  useLang(); // re-render on language toggle
  return (
    <DialogPortal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md animate-fadein" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "surface-dialog fixed start-1/2 top-1/2 z-50 grid max-h-[calc(100vh-3rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl animate-pop focus:outline-none sm:p-7",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute end-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground shadow-sm ring-1 ring-inset ring-border transition hover:bg-muted hover:text-foreground hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <X className="h-4 w-4" />
          <span className="sr-only">{t("إغلاق")}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5 pe-8 text-start", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center justify-end gap-2.5 border-t border-border pt-4", className)} {...props} />;
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-xl font-extrabold tracking-tight text-foreground", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogPortal,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
