import { useLanguageStore, Language } from '../store/useLanguageStore';
import es from '../locales/es.json';
import en from '../locales/en.json';

const dictionaries = { es, en };

export const useTranslation = () => {
  const { language, setLanguage } = useLanguageStore();

  const t = (key: string): string => {
    const keys = key.split('.');
    let result: any = dictionaries[language];

    for (const k of keys) {
      if (result && result[k] !== undefined) {
        result = result[k];
      } else {
        // Fallback to Spanish if not found in current dictionary
        let fallback: any = dictionaries['es'];
        for (const fk of keys) {
          if (fallback && fallback[fk] !== undefined) {
            fallback = fallback[fk];
          } else {
            fallback = null;
            break;
          }
        }
        return fallback || key;
      }
    }

    return typeof result === 'string' ? result : key;
  };

  return { t, language, setLanguage };
};
export type { Language };
