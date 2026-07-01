'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Construction, LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { DashboardLayout } from '../layout/DashboardLayout';

interface InDevelopmentProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function InDevelopment({ title, description, icon: Icon }: InDevelopmentProps) {
  const router = useRouter();

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 select-none">
        {/* Background decorations */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl" />
        </div>

        <motion.div
          className="relative z-10 max-w-md flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Animated icon container */}
          <motion.div
            className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-8 shadow-xl shadow-violet-500/5 relative"
            animate={{
              y: [0, -6, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Icon className="w-10 h-10 text-violet-600 dark:text-violet-400" />
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-lg bg-amber-500 border-2 border-white dark:border-zinc-950 flex items-center justify-center shadow-md">
              <Construction className="w-3.5 h-3.5 text-zinc-950" />
            </div>
          </motion.div>

          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mb-3">
            {title}
          </h1>

          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8">
            {description}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => router.push('/dashboard')}
              className="w-full sm:w-auto"
            >
              Volver al Dashboard
            </Button>
            <Button
              variant="default"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              Regresar
            </Button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
