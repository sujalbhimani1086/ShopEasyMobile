import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import {
  AppButton,
  AppInput,
  ScreenHeader,
  EmptyState,
  LoadingState,
  ErrorState,
  StatusBadge,
  SectionHeader,
} from '../src/components/common';

// Mock Theme
jest.mock('../src/theme/theme', () => ({
  useAppTheme: () => ({
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
      danger: '#EF4444',
      success: '#10B981',
    },
    radius: {
      sm: 6,
      md: 10,
      lg: 14,
    },
  }),
}));

describe('Reusable Common Components Suite', () => {
  describe('AppButton', () => {
    it('renders button title and handles press callback', () => {
      const onPressMock = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <AppButton title="Checkout" onPress={onPressMock} />
        );
      });

      const btn = renderer!.root.findByProps({ accessibilityLabel: 'Checkout' });
      expect(btn).toBeDefined();

      act(() => {
        btn.props.onPress();
      });
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('shows loading indicator and disables press when loading', () => {
      const onPressMock = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <AppButton title="Submit" loading loadingText="Submitting..." onPress={onPressMock} />
        );
      });

      const text = renderer!.root.findAllByProps({ children: 'Submitting...' });
      expect(text.length).toBeGreaterThanOrEqual(1);

      const btn = renderer!.root.findByProps({ accessibilityLabel: 'Submit' });
      expect(btn.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe('AppInput', () => {
    it('renders label, handles text change, and renders error', () => {
      const onChangeMock = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <AppInput
            label="Email Address"
            placeholder="user@example.com"
            value="test@example.com"
            onChangeText={onChangeMock}
            error="Invalid email"
          />
        );
      });

      const label = renderer!.root.findAllByProps({ children: 'Email Address' });
      expect(label.length).toBeGreaterThanOrEqual(1);

      const error = renderer!.root.findAllByProps({ children: 'Invalid email' });
      expect(error.length).toBeGreaterThanOrEqual(1);

      const input = renderer!.root.findByType(TextInput);
      act(() => {
        input.props.onChangeText('new@example.com');
      });
      expect(onChangeMock).toHaveBeenCalledWith('new@example.com');
    });

    it('supports password toggling when isPassword is true', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <AppInput label="Password" isPassword value="secret123" />
        );
      });

      const input = renderer!.root.findByType(TextInput);
      expect(input.props.secureTextEntry).toBe(true);

      const toggleBtn = renderer!.root.findByProps({ accessibilityLabel: 'Show password' });
      act(() => {
        toggleBtn.props.onPress();
      });

      expect(input.props.secureTextEntry).toBe(false);
    });
  });

  describe('ScreenHeader', () => {
    it('renders title, subtitle, back button, and right action', () => {
      const onBackMock = jest.fn();
      const onActionMock = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ScreenHeader
            title="My Wishlist"
            subtitle="3 items"
            onBack={onBackMock}
            rightActionText="Clear All"
            onRightAction={onActionMock}
          />
        );
      });

      const title = renderer!.root.findAllByProps({ children: 'My Wishlist' });
      expect(title.length).toBeGreaterThanOrEqual(1);

      const subtitle = renderer!.root.findAllByProps({ children: '3 items' });
      expect(subtitle.length).toBeGreaterThanOrEqual(1);

      const backBtn = renderer!.root.findByProps({ accessibilityLabel: 'Go back' });
      act(() => {
        backBtn.props.onPress();
      });
      expect(onBackMock).toHaveBeenCalledTimes(1);

      const actionBtn = renderer!.root.findByProps({ accessibilityLabel: 'Clear All' });
      act(() => {
        actionBtn.props.onPress();
      });
      expect(onActionMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('EmptyState', () => {
    it('renders empty title, subtitle, and action button', () => {
      const onActionMock = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <EmptyState
            icon="heart"
            title="Wishlist is empty"
            subtitle="Explore products and add items."
            actionTitle="Start Shopping"
            onAction={onActionMock}
          />
        );
      });

      const title = renderer!.root.findAllByProps({ children: 'Wishlist is empty' });
      expect(title.length).toBeGreaterThanOrEqual(1);

      const actionBtn = renderer!.root.findByProps({ accessibilityLabel: 'Start Shopping' });
      act(() => {
        actionBtn.props.onPress();
      });
      expect(onActionMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('LoadingState & ErrorState', () => {
    it('renders LoadingState with message', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<LoadingState message="Loading data..." />);
      });

      const msg = renderer!.root.findAllByProps({ children: 'Loading data...' });
      expect(msg.length).toBeGreaterThanOrEqual(1);
    });

    it('renders ErrorState with message and retry button', () => {
      const onRetryMock = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ErrorState message="Network failure" onRetry={onRetryMock} />
        );
      });

      const msg = renderer!.root.findAllByProps({ children: 'Network failure' });
      expect(msg.length).toBeGreaterThanOrEqual(1);

      const retryBtn = renderer!.root.findByProps({ accessibilityLabel: 'Retry' });
      act(() => {
        retryBtn.props.onPress();
      });
      expect(onRetryMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('StatusBadge', () => {
    it('renders badge label with resolved tone', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<StatusBadge label="DELIVERED" />);
      });

      const label = renderer!.root.findAllByProps({ children: 'DELIVERED' });
      expect(label.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('SectionHeader', () => {
    it('renders section title and action button', () => {
      const onActionMock = jest.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <SectionHeader title="Trending Deals" actionText="View All" onAction={onActionMock} />
        );
      });

      const title = renderer!.root.findAllByProps({ children: 'Trending Deals' });
      expect(title.length).toBeGreaterThanOrEqual(1);

      const actionBtn = renderer!.root.findByProps({ accessibilityLabel: 'View All' });
      act(() => {
        actionBtn.props.onPress();
      });
      expect(onActionMock).toHaveBeenCalledTimes(1);
    });
  });
});
