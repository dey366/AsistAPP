'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GraduationCap, Lock, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/store/useToastStore';

const resetSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Verify we actually have an active session (recovery token establishes a temporary session)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // If no session is found, we might have accessed this page directly without a recovery flow
        addToast({
          title: 'Sesión no encontrada',
          message: 'Debes utilizar el enlace enviado a tu correo electrónico para restablecer la contraseña.',
          type: 'error',
        });
        // We do not redirect instantly to allow local debugging, but show error
      }
    };
    checkSession();
  }, [addToast]);

  const onSubmit = async (values: ResetFormValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) throw error;

      setIsSuccess(true);
      addToast({
        title: 'Clave Restablecida',
        message: 'Tu contraseña ha sido actualizada con éxito.',
        type: 'success',
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'No se pudo actualizar la contraseña. Revisa si el enlace ya expiró.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
      
      {/* Columna Izquierda: Panel Gráfico (Oculto en Móvil) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-zinc-950 items-center justify-center p-12 select-none">
        <div className="absolute inset-0 z-0 opacity-40 bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />

        <motion.div 
          className="relative z-10 text-center max-w-md flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-2xl shadow-violet-500/10">
            <GraduationCap className="w-8 h-8 text-violet-500" />
          </div>
          
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
            Restablecer Contraseña
          </h2>
          
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Actualiza tus credenciales de acceso para volver a gestionar tu asistencia escolar de manera segura.
          </p>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 backdrop-blur text-xs text-zinc-300 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Supabase Cloud & NestJS Secured
          </div>
        </motion.div>

        <div className="absolute bottom-6 left-8 text-xs text-zinc-500 font-mono">
          AsistApp © 2026
        </div>
      </div>

      {/* Columna Derecha: Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-16">
        <motion.div 
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {/* Cabecera en Móvil */}
          <div className="lg:hidden flex flex-col items-center mb-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center mb-3 shadow-lg shadow-violet-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">AsistApp</h1>
          </div>

          {isSuccess ? (
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">¡Contraseña Actualizada!</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 mb-8">
                Tu clave ha sido reestablecida de forma segura. Ya puedes volver a iniciar sesión.
              </p>
              <Button
                onClick={() => router.push('/login')}
                className="w-full py-2.5"
              >
                Ir a Iniciar Sesión
              </Button>
            </motion.div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                  Nueva Contraseña
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
                  Establece tu nueva contraseña de acceso institucional
                </p>
              </div>

              {errorMsg && (
                <motion.div 
                  className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 flex gap-3 text-sm text-red-600 dark:text-red-400"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <div>{errorMsg}</div>
                </motion.div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <FormInput
                  label="Nueva Contraseña"
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  error={errors.password?.message}
                  {...register('password')}
                />

                <FormInput
                  label="Confirmar Nueva Contraseña"
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />

                <Button 
                  type="submit" 
                  className="w-full py-2.5 mt-4" 
                  isLoading={isSubmitting}
                >
                  Guardar Contraseña
                </Button>
              </form>
            </>
          )}

        </motion.div>
      </div>

    </div>
  );
}
