import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, Switch, Pressable } from 'react-native';
import {
  ThemeProvider,
  useAppTheme,
  useTheme,
  THEME_STORAGE_KEY,
  LightTheme,
  DarkTheme,
} from '../src/theme/theme';
import { UserProfileModal } from '../src/components/UserProfileModal';
import type { User } from '../src/types/auth';

const mockUser: User = {
  id: 1,
  name: 'Sujal Test',
  email: 'sujal@gmail.com',
  role: 'CUSTOMER',
  status: 'APPROVED',
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

describe('Theme System and Appearance Settings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('ThemeProvider and Context', () => {
    it('defaults to dark theme when no saved preference exists', async () => {
      let themeRef: ReturnType<typeof useAppTheme> | null = null;

      function Consumer() {
        themeRef = useAppTheme();
        return <Text>{themeRef.themeMode}</Text>;
      }

      await act(async () => {
        ReactTestRenderer.create(
          <ThemeProvider>
            <Consumer />
          </ThemeProvider>
        );
      });

      expect(themeRef).not.toBeNull();
      expect(themeRef!.themeMode).toBe('dark');
      expect(themeRef!.isDark).toBe(true);
      expect(themeRef!.colors.background).toBe(DarkTheme.colors.background);
    });

    it('restores saved light theme preference from AsyncStorage on restart', async () => {
      // Pre-save 'light' preference in storage
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'light');

      let themeRef: ReturnType<typeof useAppTheme> | null = null;

      function Consumer() {
        themeRef = useAppTheme();
        return <Text>{themeRef.themeMode}</Text>;
      }

      await act(async () => {
        ReactTestRenderer.create(
          <ThemeProvider>
            <Consumer />
          </ThemeProvider>
        );
      });

      await act(async () => {
        await delay(30);
      });

      expect(themeRef!.themeMode).toBe('light');
      expect(themeRef!.isDark).toBe(false);
      expect(themeRef!.colors.background).toBe(LightTheme.colors.background);
    });

    it('toggles theme between dark and light, persisting preference to AsyncStorage', async () => {
      let themeRef: ReturnType<typeof useAppTheme> | null = null;

      function Consumer() {
        themeRef = useAppTheme();
        return (
          <Pressable onPress={() => themeRef?.toggleTheme()}>
            <Text>{themeRef.themeMode}</Text>
          </Pressable>
        );
      }

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <Consumer />
          </ThemeProvider>
        );
      });

      expect(themeRef!.themeMode).toBe('dark');

      // Toggle dark -> light
      await act(async () => {
        themeRef!.toggleTheme();
      });

      expect(themeRef!.themeMode).toBe('light');
      expect(themeRef!.isDark).toBe(false);
      expect(themeRef!.colors.background).toBe(LightTheme.colors.background);

      // Verify persisted to AsyncStorage
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      expect(stored).toBe('light');

      // Toggle light -> dark
      await act(async () => {
        themeRef!.toggleTheme();
      });

      expect(themeRef!.themeMode).toBe('dark');
      expect(themeRef!.isDark).toBe(true);
      expect(themeRef!.colors.background).toBe(DarkTheme.colors.background);

      const storedAfter = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      expect(storedAfter).toBe('dark');
    });

    it('explicitly sets themeMode via setThemeMode() and saves to AsyncStorage', async () => {
      let themeRef: ReturnType<typeof useAppTheme> | null = null;

      function Consumer() {
        themeRef = useTheme();
        return <Text>{themeRef.themeMode}</Text>;
      }

      await act(async () => {
        ReactTestRenderer.create(
          <ThemeProvider>
            <Consumer />
          </ThemeProvider>
        );
      });

      await act(async () => {
        themeRef!.setThemeMode('light');
      });

      expect(themeRef!.themeMode).toBe('light');
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

      await act(async () => {
        themeRef!.setThemeMode('dark');
      });

      expect(themeRef!.themeMode).toBe('dark');
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('gracefully provides fallback theme when used outside of ThemeProvider without crashing', () => {
      let themeRef: ReturnType<typeof useAppTheme> | null = null;

      function StandaloneConsumer() {
        themeRef = useAppTheme();
        return <Text>{themeRef.themeMode}</Text>;
      }

      act(() => {
        ReactTestRenderer.create(<StandaloneConsumer />);
      });

      expect(themeRef).not.toBeNull();
      expect(themeRef!.isDark).toBe(true);
      expect(themeRef!.colors).toBeDefined();
    });
  });

  describe('UserProfileModal Appearance Toggle', () => {
    it('renders Appearance label, current mode with icon, and working switch in the modal', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      const onClose = jest.fn();
      const onLogout = jest.fn();

      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <UserProfileModal
              visible={true}
              user={mockUser}
              onClose={onClose}
              onLogout={onLogout}
            />
          </ThemeProvider>
        );
      });

      const root = renderer!.root;
      const texts = root.findAllByType(Text).map((t) => t.props.children);

      // Verify Appearance section labels are present
      expect(texts).toContain('Appearance');
      expect(texts).toContain('Dark');
      expect(texts).toContain('Account Type');
      expect(texts).not.toContain('Status');

      // Verify Switch component is rendered with value reflecting dark mode
      const switches = root.findAllByType(Switch);
      expect(switches.length).toBe(1);
      expect(switches[0].props.value).toBe(true); // Dark mode is active
    });

    it('updates the theme immediately when the user changes the switch', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      const onClose = jest.fn();
      const onLogout = jest.fn();

      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <UserProfileModal
              visible={true}
              user={mockUser}
              onClose={onClose}
              onLogout={onLogout}
            />
          </ThemeProvider>
        );
      });

      const root = renderer!.root;
      const themeSwitch = root.findByType(Switch);

      // Simulate toggling switch off (switches from dark to light)
      await act(async () => {
        themeSwitch.props.onValueChange(false);
      });

      // Verify the modal text immediately updates to 'Light'
      const updatedTexts = root.findAllByType(Text).map((t) => t.props.children);
      expect(updatedTexts).toContain('Light');
      expect(updatedTexts).not.toContain('Dark');

      // Verify Switch value updated to false
      const updatedSwitch = root.findByType(Switch);
      expect(updatedSwitch.props.value).toBe(false);

      // Verify preference saved to storage
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      expect(stored).toBe('light');

      // Simulate toggling back to dark
      await act(async () => {
        updatedSwitch.props.onValueChange(true);
      });

      const backToDarkTexts = root.findAllByType(Text).map((t) => t.props.children);
      expect(backToDarkTexts).toContain('Dark');
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('preserves My Orders and Sign Out buttons functionality alongside Appearance toggle', async () => {
      const onClose = jest.fn();
      const onLogout = jest.fn();
      const onMyOrders = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <UserProfileModal
              visible={true}
              user={mockUser}
              onClose={onClose}
              onLogout={onLogout}
              onMyOrders={onMyOrders}
            />
          </ThemeProvider>
        );
      });

      const root = renderer!.root;
      const buttons = root.findAllByType(Pressable);

      // Find My Orders button and press it
      const myOrdersBtn = root.findAll(
        (b) => b.props && b.props.accessibilityLabel === 'View my orders'
      )[0];
      expect(myOrdersBtn).toBeDefined();

      await act(async () => {
        myOrdersBtn.props.onPress();
      });

      expect(onClose).toHaveBeenCalled();
      expect(onMyOrders).toHaveBeenCalled();

      // Find Sign Out button and press it
      const signOutBtn = root.findAll(
        (b) => b.props && b.props.accessibilityLabel === 'Sign out of account'
      )[0];
      expect(signOutBtn).toBeDefined();

      await act(async () => {
        signOutBtn.props.onPress();
      });

      // Confirmation box appears
      const confirmLogoutBtn = root.findAll(
        (b) => b.props && b.props.accessibilityLabel === 'Confirm sign out'
      )[0];
      expect(confirmLogoutBtn).toBeDefined();

      await act(async () => {
        confirmLogoutBtn.props.onPress();
      });

      expect(onLogout).toHaveBeenCalled();
    });
  });
});
