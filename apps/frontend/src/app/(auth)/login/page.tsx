'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Lock, Mail, AlertTriangle, ShieldCheck, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

// Esquema de validación con Zod
const loginSchema = z.object({
  email: z.string().min(1, 'El correo electrónico es requerido').email('Correo electrónico no válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmail, loginWithGoogle, error: authError } = useAuthStore();
  
  // Auth views: login or forgot-password
  const [view, setView] = useState<'login' | 'forgot-password'>('login');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Forgot password states
  const [resetEmail, setResetEmail] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await loginWithEmail(values.email, values.password);
      router.push('/dashboard');
    } catch (err: any) {
      setSubmitError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleSubmitting(true);
    setSubmitError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google SSO login error:', err);
      // Translate the Supabase error for un-enabled SSO provider
      if (err.message?.includes('provider is not enabled') || err.message?.includes('Unsupported provider')) {
        setSubmitError('El inicio de sesión con Google no está habilitado en tu proyecto de Supabase. Para activarlo, debes ingresar a tu consola de Supabase > Authentication > Providers > Google y habilitarlo.');
      } else {
        setSubmitError(err.message || 'Error al conectar con Google SSO.');
      }
      setIsGoogleSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetError('Por favor ingresa tu correo electrónico.');
      return;
    }
    setIsResetSubmitting(true);
    setResetError(null);
    setResetSuccess(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSuccess(true);
    } catch (err: any) {
      console.error(err);
      setResetError(err.message || 'No se pudo enviar el correo de recuperación.');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
      
      {/* Columna Izquierda: Panel Gráfico (Oculto en Móvil) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-zinc-950 items-center justify-center p-12 select-none">
        
        {/* Fondo decorativo con rejillas de gradientes */}
        <div className="absolute inset-0 z-0 opacity-40 bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />

        {/* Contenido Visual */}
        <motion.div 
          className="relative z-10 text-center max-w-md flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Logo animado */}
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-2xl shadow-violet-500/10">
            <GraduationCap className="w-8 h-8 text-violet-500" />
          </div>
          
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
            Sistema Web de Control de Asistencia Académico
          </h2>
          
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Monitoreo en tiempo real, reglas de puntualidad automatizadas y reportes de ausentismo diseñados para instituciones de alto rendimiento.
          </p>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 backdrop-blur text-xs text-zinc-300 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Supabase Cloud & NestJS Secured
          </div>
        </motion.div>

        {/* Indicador de marca en esquina inferior */}
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Control de asistencia académica</p>
          </div>

          <AnimatePresence mode="wait">
            {view === 'login' ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                    Iniciar Sesión
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
                    Accede al dashboard institucional de AsistApp
                  </p>
                </div>

                {/* Errores del Servidor */}
                {(submitError || authError) && (
                  <motion.div 
                    className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 flex gap-3 text-sm text-red-600 dark:text-red-400"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>{submitError || authError}</div>
                  </motion.div>
                )}

                {/* Formulario */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <FormInput
                    label="Correo Institucional"
                    type="email"
                    placeholder="nombre@universidad.edu"
                    icon={<Mail className="w-4 h-4" />}
                    error={errors.email?.message}
                    {...register('email')}
                  />

                  <FormInput
                    label="Contraseña"
                    type="password"
                    placeholder="••••••••"
                    icon={<Lock className="w-4 h-4" />}
                    error={errors.password?.message}
                    {...register('password')}
                  />

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-300 dark:border-zinc-800 text-violet-600 focus:ring-violet-500 dark:bg-zinc-900" 
                      />
                      Recordar sesión
                    </label>
                    <button 
                      type="button"
                      onClick={() => {
                        setView('forgot-password');
                        setSubmitError(null);
                        setResetError(null);
                        setResetSuccess(false);
                      }}
                      className="text-violet-600 hover:underline font-medium focus:outline-none"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full py-2.5 mt-4" 
                    isLoading={isSubmitting}
                    disabled={isGoogleSubmitting}
                  >
                    Ingresar con Email
                  </Button>
                </form>

                {/* Divisor */}
                <div className="relative my-8 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <span className="relative z-10 px-3 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-400 dark:text-zinc-500 font-mono">
                    O CONTINUAR CON
                  </span>
                </div>

                {/* Botón Google SSO */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full py-2.5 flex items-center justify-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  onClick={handleGoogleLogin}
                  isLoading={isGoogleSubmitting}
                  disabled={isSubmitting}
                >
                  {/* SVG Logo original Google */}
                  {!isGoogleSubmitting && (
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" width="24" height="24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  Google SSO
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                    ¿Olvidaste tu contraseña?
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
                    Ingresa tu correo para recibir un enlace de restablecimiento de contraseña.
                  </p>
                </div>

                {/* Mensaje de Éxito */}
                {resetSuccess && (
                  <motion.div 
                    className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 flex gap-3 text-sm text-emerald-600 dark:text-emerald-400"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                    <div>Hemos enviado un correo electrónico con instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada y spam.</div>
                  </motion.div>
                )}

                {/* Errores */}
                {resetError && (
                  <motion.div 
                    className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 flex gap-3 text-sm text-red-600 dark:text-red-400"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>{resetError}</div>
                  </motion.div>
                )}

                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <FormInput
                    label="Correo Institucional"
                    type="email"
                    placeholder="nombre@universidad.edu"
                    icon={<Mail className="w-4 h-4" />}
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />

                  <Button 
                    type="submit" 
                    className="w-full py-2.5 mt-4" 
                    isLoading={isResetSubmitting}
                    disabled={resetSuccess}
                  >
                    Enviar Enlace de Recuperación
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setView('login');
                      setSubmitError(null);
                      setResetError(null);
                      setResetSuccess(false);
                    }}
                    className="w-full py-2.5 flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors focus:outline-none"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Iniciar Sesión
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>

    </div>
  );
}
