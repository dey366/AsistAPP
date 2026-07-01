import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useUiStore } from './useUiStore';

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  career_id?: string | null;
  is_active: boolean;
  avatar_url?: string | null;
  tenant_id?: string | null;
  ui_preferences?: Record<string, any> | null;
}

interface AuthState {
  user: UserProfile | null;
  session: any | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Métodos
  initialize: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: (token: string) => Promise<UserProfile | null>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const setCookie = (name: string, value: string, maxAge = 604800) => {
  if (typeof window !== 'undefined') {
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
  }
};

const removeCookie = (name: string) => {
  if (typeof window !== 'undefined') {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  token: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      // 1. Obtener sesión activa inicial
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const token = session.access_token;
        const profile = await get().fetchProfile(token);
        
        if (profile) {
          setCookie('asistapp-token', token);
          setCookie('asistapp-role', profile.role_id);
          useUiStore.getState().loadPreferences(profile);
        }
        
        set({
          session,
          token,
          user: profile,
          isLoading: false,
        });
      } else {
        removeCookie('asistapp-token');
        removeCookie('asistapp-role');
        set({ session: null, token: null, user: null, isLoading: false });
      }

      // 2. Escuchar cambios de estado en Supabase Auth
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (newSession) {
          const token = newSession.access_token;
          const profile = await get().fetchProfile(token);
          
          if (profile) {
            setCookie('asistapp-token', token);
            setCookie('asistapp-role', profile.role_id);
            useUiStore.getState().loadPreferences(profile);
          }
          
          set({
            session: newSession,
            token,
            user: profile,
            isLoading: false,
          });
        } else {
          removeCookie('asistapp-token');
          removeCookie('asistapp-role');
          set({ session: null, token: null, user: null, isLoading: false });
        }
      });
    } catch (err: any) {
      removeCookie('asistapp-token');
      removeCookie('asistapp-role');
      set({
        error: err.message || 'Error al inicializar la autenticación',
        isLoading: false,
      });
    }
  },

  fetchProfile: async (token: string): Promise<UserProfile | null> => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('No se pudo recuperar el perfil del servidor');
      }

      const data = await response.json();
      return data.user;
    } catch (err) {
      console.warn('Error al hacer fetch al perfil del backend, intentando fallback directo a Supabase:', err);
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser(token);
        if (authUser) {
          const { data: dbUser, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
            
          if (dbUser && !error) {
            return {
              id: dbUser.id,
              email: dbUser.email,
              first_name: dbUser.first_name || '',
              last_name: dbUser.last_name || '',
              role_id: dbUser.role_id || 'estudiante',
              career_id: dbUser.career_id,
              is_active: dbUser.is_active ?? true,
              avatar_url: dbUser.avatar_url,
              tenant_id: dbUser.tenant_id,
              ui_preferences: dbUser.ui_preferences
            };
          }
        }
      } catch (fallbackErr) {
        console.error('Error en fallback de perfil de Supabase:', fallbackErr);
      }
      return null;
    }
  },

  loginWithEmail: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        const token = data.session.access_token;
        const profile = await get().fetchProfile(token);
        
        if (profile) {
          setCookie('asistapp-token', token);
          setCookie('asistapp-role', profile.role_id);
          useUiStore.getState().loadPreferences(profile);
        }
        
        set({
          session: data.session,
          token,
          user: profile,
          isLoading: false,
        });
      }
    } catch (err: any) {
      removeCookie('asistapp-token');
      removeCookie('asistapp-role');
      set({
        error: err.message || 'Credenciales inválidas',
        isLoading: false,
      });
      throw err;
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      set({
        error: err.message || 'Error al iniciar sesión con Google SSO',
        isLoading: false,
      });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      removeCookie('asistapp-token');
      removeCookie('asistapp-role');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, session: null, token: null, isLoading: false, error: null });
    } catch (err: any) {
      set({
        error: err.message || 'Error al cerrar sesión',
        isLoading: false,
      });
    }
  },
}));
