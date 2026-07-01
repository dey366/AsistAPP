'use client'

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'critical_attendance' | 'justification_approved' | 'justification_rejected' | 'general' | 'justification_submitted';
  is_read: boolean;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function useNotifications() {
  const { user, token } = useAuthStore();
  const { addToast } = useToastStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Cargar notificaciones del usuario de forma asíncrona
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      } else if (response.status === 401) {
        console.warn('Token de sesión no autorizado o expirado al obtener notificaciones. Cerrando sesión...');
        useAuthStore.getState().logout();
      } else {
        console.error('Error HTTP al obtener notificaciones:', response.status);
      }
    } catch (err) {
      console.error('Error al realizar fetch de notificaciones:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // 2. Marcar una notificación específica como leída
  const markAsRead = useCallback(async (id: string) => {
    if (!token) return;

    // Mutación optimista en el cliente
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    try {
      const response = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Error al actualizar en el servidor');
      }
    } catch (err) {
      console.error('Error al marcar notificación como leída en backend:', err);
      // Revertir cambio optimista en caso de fallo crítico
      fetchNotifications();
    }
  }, [token, fetchNotifications]);

  // 3. Marcar todas las notificaciones como leídas
  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    // Mutación optimista en el cliente
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    try {
      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Error al actualizar en el servidor');
      }
    } catch (err) {
      console.error('Error al marcar todas las notificaciones en backend:', err);
      // Revertir cambio optimista
      fetchNotifications();
    }
  }, [token, fetchNotifications]);

  // 4. Configurar llamadas iniciales y suscripción en tiempo real con Supabase
  useEffect(() => {
    if (!user || !token) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    // Cargar iniciales
    fetchNotifications();

    // Crear y configurar el canal WebSocket de Supabase
    const channelName = `realtime-notifications-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          
          // 1. Inyectar de manera reactiva en el estado local de notificaciones
          setNotifications((prev) => {
            // Evitar duplicados por seguridad
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });

          // 2. Disparar un Toast visual de alta fidelidad estética
          addToast({
            title: newNotif.title,
            message: newNotif.message,
            type: newNotif.type,
            duration: 6000,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Suscripción exitosa a notificaciones para: ${user.email}`);
        }
      });

    // Limpiar al desmontar o al cambiar de usuario
    return () => {
      supabase.removeChannel(channel);
      console.log(`[Realtime] Conexión cerrada para el canal: ${channelName}`);
    };
  }, [user, token, fetchNotifications, addToast]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
