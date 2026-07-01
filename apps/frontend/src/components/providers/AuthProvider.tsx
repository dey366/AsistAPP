'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { initialize, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
        {/* Fondo decorativo con gradientes suaves */}
        <div className="absolute inset-0 z-0 opacity-30 dark:opacity-20 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-violet-500/10 dark:bg-violet-600/10 blur-3xl" />
          <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-indigo-500/10 dark:bg-indigo-600/10 blur-3xl" />
        </div>

        {/* Contenedor central */}
        <div className="relative z-10 flex flex-col items-center max-w-xs text-center px-4 select-none">
          {/* Logo animado con efecto de respiración */}
          <motion.div
            className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-6 shadow-xl shadow-violet-500/5"
            animate={{
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 4px 20px -2px rgba(139, 92, 246, 0.05)',
                '0 4px 30px 2px rgba(139, 92, 246, 0.15)',
                '0 4px 20px -2px rgba(139, 92, 246, 0.05)',
              ],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <GraduationCap className="w-8 h-8 text-violet-600 dark:text-violet-500" />
          </motion.div>

          {/* Nombre de la marca */}
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
            AsistApp
          </h1>

          {/* Estado de carga */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-5">
            Estableciendo conexión segura...
          </p>

          {/* Barra de progreso Notion/Linear-style */}
          <div className="w-40 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
