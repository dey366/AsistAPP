'use client'

import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, helperText, icon, className, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col space-y-1.5 text-left">
        {label && (
          <label 
            className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 select-none"
          >
            {label}
          </label>
        )}
        <div className="relative w-full">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 dark:text-zinc-500 flex items-center pointer-events-none z-10">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              "flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all duration-150 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:cursor-not-allowed disabled:opacity-50",
              icon ? "pl-9" : "",
              error ? "border-destructive focus:ring-destructive focus:border-destructive" : "",
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <span className="text-xs font-medium text-destructive leading-none">{error}</span>
        ) : helperText ? (
          <span className="text-xs text-muted-foreground leading-none">{helperText}</span>
        ) : null}
      </div>
    )
  }
)

FormInput.displayName = 'FormInput'
