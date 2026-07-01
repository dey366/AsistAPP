import { create } from 'zustand'

export type Language = 'es' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'es', // Valor predeterminado
  setLanguage: (language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('asistapp-lang', language);
    }
    set({ language });
  },
}));

// Inicializar el idioma si estamos en el cliente
if (typeof window !== 'undefined') {
  const savedLang = localStorage.getItem('asistapp-lang') as Language;
  if (savedLang) {
    useLanguageStore.getState().setLanguage(savedLang);
  }
}
