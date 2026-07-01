'use client'

import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { motion } from 'framer-motion'

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar de navegación */}
      <Sidebar />

      {/* Contenedor Principal (Topbar + Contenido) */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Topbar horizontal */}
        <Topbar />

        {/* Área de contenido del Dashboard */}
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mx-auto max-w-7xl space-y-6"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
