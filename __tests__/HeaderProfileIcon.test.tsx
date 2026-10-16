import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import { Header } from '../src/components/Header';
import { ThemeProvider } from '../src/theme/theme';
import { FeedbackProvider } from '../src/context/FeedbackContext';

function renderHeader(props: any, isDark = true) {
  return ReactTestRenderer.create(
    <ThemeProvider initialMode={isDark ? 'dark' : 'light'}>
      <FeedbackProvider>
        <Header {...props} />
      </FeedbackProvider>
    </ThemeProvider>
  );
}

describe('Header Profile Icon — Green Dot Removal', () => {
  it('1. Renders profile icon without the green dot indicator when logged in', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = renderHeader({
        isLoggedIn: true,
        userName: 'Sujal Customer',
        onAccountPress: jest.fn(),
      });
    });

    const accountBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Account (Sujal Customer)',
    });
    expect(accountBtn).toBeDefined();

    // Verify user icon is rendered
    const userIcon = accountBtn.findByProps({ name: 'user' });
    expect(userIcon).toBeDefined();
    expect(userIcon.props.size).toBe(19);
    expect(userIcon.props.color).toBe('#FFFFFF');

    // Verify NO green dot indicator exists
    const greenViews = accountBtn.findAll(
      (node) =>
        node.type === View &&
        (node.props.style?.backgroundColor === '#10B981' ||
          (Array.isArray(node.props.style) &&
            node.props.style.some((s: any) => s?.backgroundColor === '#10B981')))
    );
    expect(greenViews.length).toBe(0);
  });

  it('2. Renders profile icon without the green dot when logged out in light mode', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = renderHeader(
        {
          isLoggedIn: false,
          onAccountPress: jest.fn(),
        },
        false
      );
    });

    const accountBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Sign In',
    });
    expect(accountBtn).toBeDefined();

    const userIcon = accountBtn.findByProps({ name: 'user' });
    expect(userIcon).toBeDefined();

    const greenViews = accountBtn.findAll(
      (node) =>
        node.type === View &&
        (node.props.style?.backgroundColor === '#10B981' ||
          (Array.isArray(node.props.style) &&
            node.props.style.some((s: any) => s?.backgroundColor === '#10B981')))
    );
    expect(greenViews.length).toBe(0);
  });

  it('3. Successfully triggers onAccountPress on tap', () => {
    const onAccountPressMock = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = renderHeader({
        isLoggedIn: true,
        userName: 'Sujal',
        onAccountPress: onAccountPressMock,
      });
    });

    const accountBtn = renderer!.root.findByProps({
      accessibilityLabel: 'Account (Sujal)',
    });

    act(() => {
      accountBtn.props.onPress();
    });

    expect(onAccountPressMock).toHaveBeenCalledTimes(1);
  });
});
