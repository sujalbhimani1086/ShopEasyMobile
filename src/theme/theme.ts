import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = '@shopeasy_theme_preference';

export const LightTheme = {
  isDark: false,
  colors: {
    background: '#FFFFFF',
    card: '#FFFFFF',
    surfaceSubtle: '#F5F5F5',
    text: '#111111',
    textSecondary: '#666666',
    textMuted: '#888888',
    border: '#E5E5E5',
    borderLight: '#F0F0F0',
    primary: '#000000',
    primaryText: '#FFFFFF',
    accent: '#F59E0B',
    brandBlue: '#000000',
    success: '#10B981',
    successBg: '#E6F9F2',
    danger: '#EF4444',
    dangerBg: '#FEECEC',
    badgeBg: '#000000',
    badgeText: '#FFFFFF',
    cardShadow: 'rgba(0, 0, 0, 0.06)',
    bannerBg: '#000000',
    bannerText: '#FFFFFF',
    bannerSubtext: '#FFFFFF',
    bannerTagBg: 'rgba(255, 255, 255, 0.15)',
    bannerTagText: '#FFFFFF',
    bannerBtnBg: 'rgba(255, 255, 255, 0.18)',
    bannerBtnText: '#FFFFFF',
    chipSelectedBg: '#000000',
    chipSelectedText: '#FFFFFF',
    chipUnselectedBg: '#F5F5F5',
    chipUnselectedText: '#111111',
    modalOverlay: 'rgba(0, 0, 0, 0.6)',
    divider: '#E5E5E5',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },
};

export const DarkTheme = {
  isDark: true,
  colors: {
    background: '#000000',
    card: '#111111',
    surfaceSubtle: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    textMuted: '#777777',
    border: '#333333',
    borderLight: '#262626',
    primary: '#FFFFFF',
    primaryText: '#000000',
    accent: '#F59E0B',
    brandBlue: '#FFFFFF',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.15)',
    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    badgeBg: '#FFFFFF',
    badgeText: '#000000',
    cardShadow: '#000000',
    bannerBg: '#000000',
    bannerText: '#FFFFFF',
    bannerSubtext: '#FFFFFF',
    bannerTagBg: 'rgba(255, 255, 255, 0.15)',
    bannerTagText: '#FFFFFF',
    bannerBtnBg: 'rgba(255, 255, 255, 0.18)',
    bannerBtnText: '#FFFFFF',
    chipSelectedBg: '#FFFFFF',
    chipSelectedText: '#000000',
    chipUnselectedBg: '#1A1A1A',
    chipUnselectedText: '#B3B3B3',
    modalOverlay: 'rgba(0, 0, 0, 0.75)',
    divider: '#333333',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },
};

export type ThemeColors = typeof DarkTheme.colors;

export interface ThemeContextValue {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof DarkTheme.spacing;
  radius: typeof DarkTheme.radius;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export type AppTheme = ThemeContextValue;

// Fallback value for components tested or rendered outside of ThemeProvider
const defaultContextValue: ThemeContextValue = {
  themeMode: 'dark',
  isDark: true,
  colors: DarkTheme.colors,
  spacing: DarkTheme.spacing,
  radius: DarkTheme.radius,
  toggleTheme: () => {},
  setThemeMode: () => {},
};

export const ThemeContext = createContext<ThemeContextValue>(defaultContextValue);

export interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialMode,
}) => {
  // Default to 'dark' for existing users unless saved preference exists
  const [themeMode, setThemeModeState] = useState<ThemeMode>(
    initialMode || 'dark'
  );

  // Restore saved theme preference on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (
          isMounted &&
          stored &&
          (stored === 'dark' || stored === 'light')
        ) {
          setThemeModeState(stored);
        }
      } catch (err) {
        console.warn('ThemeProvider: Failed to restore theme preference:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch((err) => {
      console.warn('ThemeProvider: Failed to persist theme preference:', err);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch((err) => {
        console.warn('ThemeProvider: Failed to persist theme preference:', err);
      });
      return next;
    });
  }, []);

  const activePalette = themeMode === 'light' ? LightTheme : DarkTheme;

  const contextValue: ThemeContextValue = useMemo(
    () => ({
      themeMode,
      isDark: activePalette.isDark,
      colors: activePalette.colors,
      spacing: activePalette.spacing,
      radius: activePalette.radius,
      toggleTheme,
      setThemeMode,
    }),
    [themeMode, activePalette, toggleTheme, setThemeMode]
  );

  return React.createElement(
    ThemeContext.Provider,
    { value: contextValue },
    children
  ) as React.ReactElement;
};

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export const useTheme = useAppTheme;
