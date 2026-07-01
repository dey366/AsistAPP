'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUiStore } from '@/store/useUiStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useNotifications, Notification } from '@/hooks/useNotifications'
import { useTranslation } from '@/hooks/useTranslation'
import { AnimatePresence, motion } from 'framer-motion'
import { 
  Sun, 
  Moon, 
  Menu, 
  Bell, 
  Search,
  User,
  LogOut,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Check,
  Inbox,
  Loader2,
  Languages
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Utilidad para calcular el tiempo transcurrido
function formatDistanceToNow(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) return 'Ahora mismo';
  if (diffInSeconds < 60) return `Hace ${diffInSeconds} s`;
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Hace ${diffInMinutes} m`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Hace ${diffInHours} h`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `Hace ${diffInDays} d`;
  
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

const notificationIcons = {
  critical_attendance: <AlertTriangle className="w-4 h-4 text-red-500" />,
  justification_approved: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  justification_rejected: <XCircle className="w-4 h-4 text-amber-500" />,
  justification_submitted: <FileText className="w-4 h-4 text-blue-500" />,
  general: <Bell className="w-4 h-4 text-indigo-500" />,
};

const bgColors = {
  critical_attendance: 'bg-red-500/10 dark:bg-red-500/20 border-red-500/20 text-red-700 dark:text-red-300',
  justification_approved: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  justification_rejected: 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 text-amber-700 dark:text-amber-300',
  justification_submitted: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/20 text-blue-700 dark:text-blue-300',
  general: 'bg-zinc-500/10 dark:bg-zinc-500/20 border-zinc-500/20 text-zinc-700 dark:text-zinc-300',
};

export function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useUiStore()
  const { user, logout } = useAuthStore()
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications()
  const { t, language, setLanguage } = useTranslation()

  // Estados para modales/popovers
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)

  // Referencias para cerrar popovers al hacer clic afuera
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)

  const roleNames: Record<string, string> = {
    admin: t('nav.admin'),
    supervisor: t('nav.supervisor'),
    docente: t('nav.docente'),
    estudiante: t('nav.estudiante'),
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setShowLangMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Generar breadcrumbs
  const pathSegments = pathname.split('/').filter(segment => segment !== '')
  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/')
    const name = segment.charAt(0).toUpperCase() + segment.slice(1)
    return { name, href }
  })

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
    }
  }

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-card border-b border-border select-none shrink-0 z-40 relative">
      {/* Sección Izquierda: Toggle Sidebar + Breadcrumbs */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground md:flex hidden items-center justify-center shrink-0 transition-colors duration-150 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Migas de Pan (Breadcrumbs) */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="hover:text-foreground cursor-pointer font-medium" onClick={() => router.push('/dashboard')}>AsistApp</span>
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.href} className="flex items-center gap-1.5">
              <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-700" />
              <span 
                className={cn(
                  "font-medium", 
                  idx === breadcrumbs.length - 1 ? "text-primary font-semibold" : "hover:text-foreground cursor-pointer"
                )}
                onClick={() => idx < breadcrumbs.length - 1 && router.push(crumb.href)}
              >
                {crumb.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sección Derecha: Buscar, Notificaciones, Tema, Perfil */}
      <div className="flex items-center gap-4">
        {/* Barra de búsqueda minimalista tipo Vercel */}
        <div className="relative max-w-xs md:flex hidden items-center">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('nav.search')}
            className="h-9 pl-9 pr-4 rounded-lg border border-border bg-muted/30 focus:bg-background text-sm w-48 focus:outline-none focus:ring-1 focus:ring-primary transition-all duration-150 focus:w-60"
          />
        </div>

        {/* Notificaciones Popover Wrapper */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              "p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground relative transition-colors duration-150 cursor-pointer",
              showNotifications && "bg-muted text-foreground"
            )}
            aria-label="Ver notificaciones"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Popover Notion-Style */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden z-50 flex flex-col"
              >
                {/* Cabecera */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{t('notifications.title')}</span>
                    {unreadCount > 0 && (
                      <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {t('notifications.mark_all_read')}
                    </button>
                  )}
                </div>

                {/* Listado */}
                <div className="max-h-[360px] overflow-y-auto divide-y divide-border/60">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs font-medium">{t('common.loading')}</span>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60 gap-3 px-4">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
                        <Inbox className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground/80">{t('notifications.empty')}</p>
                      </div>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        onClick={() => !notif.is_read && markAsRead(notif.id)}
                        className={cn(
                          "p-4 flex gap-3 transition-colors duration-150 text-left relative group",
                          notif.is_read 
                            ? "hover:bg-muted/30 bg-background/50 text-muted-foreground" 
                            : "bg-primary/[0.02] hover:bg-primary/[0.04] text-foreground cursor-pointer"
                        )}
                      >
                        {/* Icono temático */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                          bgColors[notif.type] || bgColors.general
                        )}>
                          {notificationIcons[notif.type] || notificationIcons.general}
                        </div>

                        {/* Detalles */}
                        <div className="flex-1 flex flex-col gap-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className={cn(
                              "text-xs font-semibold leading-snug tracking-tight",
                              !notif.is_read && "text-foreground"
                            )}>
                              {notif.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground/75 whitespace-nowrap pt-0.5">
                              {formatDistanceToNow(notif.created_at)}
                            </span>
                          </div>
                          <p className="text-xs leading-normal opacity-90 font-normal pr-4">
                            {notif.message}
                          </p>
                        </div>

                        {/* Indicador no leído interactivo */}
                        {!notif.is_read && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span 
                              className="w-5 h-5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center cursor-pointer transition-colors"
                              title="Marcar como leída"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notif.id);
                                }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        )}
                        {!notif.is_read && (
                          <div className="absolute right-4 top-4 w-2 h-2 rounded-full bg-primary group-hover:opacity-0 transition-opacity" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer del Popover */}
                <div className="px-4 py-2 border-t border-border bg-muted/20 text-center">
                  <span className="text-[10px] text-muted-foreground/70 font-medium">
                    Suscrito en tiempo real con Supabase
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selector de Idioma (ES / EN) */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className={cn(
              "p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold uppercase",
              showLangMenu && "bg-muted text-foreground"
            )}
            aria-label="Cambiar idioma"
          >
            <Languages className="w-5 h-5" />
            <span className="md:inline hidden">{language}</span>
          </button>

          <AnimatePresence>
            {showLangMenu && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-36 rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-2xl p-1.5 z-50 flex flex-col"
              >
                <button
                  onClick={() => {
                    setLanguage('es')
                    setShowLangMenu(false)
                  }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg text-left cursor-pointer transition-colors w-full",
                    language === 'es' ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted/80"
                  )}
                >
                  <span>Español</span>
                  {language === 'es' && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setLanguage('en')
                    setShowLangMenu(false)
                  }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg text-left cursor-pointer transition-colors w-full mt-1",
                    language === 'en' ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted/80"
                  )}
                >
                  <span>English</span>
                  {language === 'en' && <Check className="w-3.5 h-3.5" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selector de Tema (Sun / Moon) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
          aria-label="Cambiar tema"
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </button>

        {/* Separador */}
        <div className="w-px h-6 bg-border" />

        {/* Perfil del Usuario Dropdown */}
        <div className="relative" ref={profileRef}>
          <div 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 pl-2 cursor-pointer group select-none"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-primary overflow-hidden border border-border group-hover:border-primary/50 transition-colors">
              {user?.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt={`${user.first_name} ${user.last_name}`} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="md:flex hidden flex-col text-left">
              <span className="text-sm font-semibold leading-none group-hover:text-primary transition-colors">
                {user ? `${user.first_name} ${user.last_name}` : 'Frank Herrera'}
              </span>
              <span className="text-xs text-muted-foreground leading-none mt-1">
                {user ? roleNames[user.role_id] || user.role_id : 'Administrador'}
              </span>
            </div>
          </div>

          {/* Menú de Perfil Desplegable Premium */}
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-2xl p-1.5 z-50"
              >
                {/* Header de Info */}
                <div className="px-3 py-2.5 border-b border-border/60 mb-1 text-left">
                  <p className="text-xs font-semibold text-foreground leading-none">
                    {user ? `${user.first_name} ${user.last_name}` : 'Invitado'}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-none mt-1 truncate">
                    {user?.email || 'frank@deymos.com'}
                  </p>
                </div>

                {/* Acciones */}
                <button
                  onClick={() => {
                    setShowProfileMenu(false)
                    router.push('/dashboard')
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-foreground hover:bg-muted/80 transition-colors text-left cursor-pointer"
                >
                  <User className="w-4 h-4 text-muted-foreground" />
                  {t('nav.profile')}
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-destructive hover:bg-red-500/10 transition-colors text-left mt-1 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-destructive shrink-0" />
                  {t('nav.logout')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
