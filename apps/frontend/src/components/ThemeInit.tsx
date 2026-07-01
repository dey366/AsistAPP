'use client'

import { useEffect } from 'react'
import { useUiStore } from '@/store/useUiStore'

export function ThemeInit() {
  const setTheme = useUiStore((state) => state.setTheme)

  useEffect(() => {
    const savedTheme = localStorage.getItem('asistapp-theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      // Intentar detectar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
  }, [setTheme])

  return null
}
