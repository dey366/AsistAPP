'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '@/store/useUiStore'
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  CheckSquare, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Bell,
  Clock,
  ShieldCheck,
  Building,
  GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'

interface SidebarItem {
  name: string;
  href: string;
  icon: any;
  roles: string[];
}

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'supervisor', 'docente', 'estudiante'] },
  { name: 'Usuarios', href: '/dashboard/usuarios', icon: Users, roles: ['admin'] },
  { name: 'Horarios', href: '/dashboard/horarios', icon: Calendar, roles: ['admin', 'supervisor', 'docente', 'estudiante'] },
  { name: 'Asistencia', href: '/dashboard/asistencia', icon: CheckSquare, roles: ['admin', 'supervisor', 'docente'] },
  { name: 'Justificaciones', href: '/dashboard/justificaciones', icon: Clock, roles: ['admin', 'supervisor', 'docente', 'estudiante'] },
  { name: 'Reportes', href: '/dashboard/reportes', icon: FileText, roles: ['admin', 'supervisor', 'docente'] },
  { name: 'Departamentos', href: '/dashboard/departamentos', icon: Building, roles: ['admin'] },
  { name: 'Configuración', href: '/dashboard/configuracion', icon: Settings, roles: ['admin', 'supervisor', 'docente', 'estudiante'] }
];

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUiStore()
  const { user } = useAuthStore()

  const currentRole = user?.role_id || 'estudiante'

  const filteredItems = sidebarItems.filter(item => item.roles.includes(currentRole))

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 68 : 260 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className={cn(
        "flex flex-col h-full bg-card border-r border-border shrink-0 select-none overflow-hidden"
      )}
    >
      {/* Header Logotipo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold shrink-0">
            A
          </div>
          <AnimatePresence initial={false}>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="font-semibold text-lg tracking-tight whitespace-nowrap"
              >
                Asist<span className="text-primary font-bold">App</span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navegación Principal */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center h-10 px-3 rounded-lg text-muted-foreground transition-all duration-150 cursor-pointer relative group",
                  isActive 
                    ? "bg-secondary text-primary font-medium border-l-2 border-primary rounded-l-none" 
                    : "hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                
                <AnimatePresence initial={false}>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="ml-3 text-sm whitespace-nowrap"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>

                {sidebarCollapsed && (
                  <div className="absolute left-16 scale-0 group-hover:scale-100 bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 text-xs px-2 py-1 rounded shadow-md z-50 whitespace-nowrap transition-all duration-150">
                    {item.name}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Pie de Sidebar y Botón Colapso */}
      <div className="p-3 border-t border-border bg-muted/20 shrink-0">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full h-9 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <ChevronLeft className="w-5 h-5" />
              <span>Colapsar menú</span>
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
