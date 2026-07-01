'use client'

import { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Column<T> {
  header: ReactNode;
  accessor: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyTitle = "Sin registros",
  emptyMessage = "No se encontraron datos disponibles en este momento.",
  onRowClick
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-foreground">
          {/* Encabezado */}
          <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border select-none">
            <tr>
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={cn("h-12 px-6 align-middle text-xs uppercase tracking-wider", col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Cuerpo */}
          <tbody className="divide-y divide-border">
            {isLoading ? (
              // Skeletons de Carga Premium
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="h-16 animate-pulse bg-card">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-6 py-4">
                      <div className="h-4 rounded bg-muted/65 w-full max-w-[120px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Estado Vacío Elegante (Empty State)
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted/30 border border-border">
                      <Inbox className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">{emptyTitle}</h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">{emptyMessage}</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              // Registros de Datos Reales
              data.map((item, rIdx) => (
                <tr 
                  key={rIdx} 
                  className={cn(
                    "h-16 transition-colors duration-150 hover:bg-muted/20",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col, cIdx) => (
                    <td 
                      key={cIdx} 
                      className={cn("px-6 py-4 align-middle text-zinc-700 dark:text-zinc-300 font-medium", col.className)}
                    >
                      {col.accessor(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
