'use client'

import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore, ToastMessage } from '@/store/useToastStore';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Bell, 
  Check, 
  X 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const icons = {
  critical_attendance: <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />,
  justification_approved: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />,
  justification_rejected: <XCircle className="w-5 h-5 text-amber-500 shrink-0" />,
  justification_submitted: <FileText className="w-5 h-5 text-blue-500 shrink-0" />,
  success: <Check className="w-5 h-5 text-emerald-500 shrink-0" />,
  error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
  general: <Bell className="w-5 h-5 text-indigo-500 shrink-0" />,
};

const borderColors = {
  critical_attendance: 'border-red-500/30 dark:border-red-500/20 bg-red-50/80 dark:bg-red-950/20 text-red-900 dark:text-red-200',
  justification_approved: 'border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200',
  justification_rejected: 'border-amber-500/30 dark:border-amber-500/20 bg-amber-50/80 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200',
  justification_submitted: 'border-blue-500/30 dark:border-blue-500/20 bg-blue-50/80 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200',
  success: 'border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200',
  error: 'border-red-500/30 dark:border-red-500/20 bg-red-50/80 dark:bg-red-950/20 text-red-900 dark:text-red-200',
  general: 'border-border/60 bg-background/80 text-foreground',
};

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 10, transition: { duration: 0.15 } }}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-200",
              borderColors[toast.type] || borderColors.general
            )}
          >
            <div className="mt-0.5">
              {icons[toast.type] || icons.general}
            </div>
            
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-sm font-semibold tracking-tight leading-tight">
                {toast.title}
              </span>
              <p className="text-xs opacity-90 leading-normal">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-current shrink-0"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
