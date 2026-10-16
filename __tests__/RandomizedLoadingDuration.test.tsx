import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { View, Text, ActivityIndicator } from 'react-native';
import {
  getRandomLoadingDuration,
  withRandomLoadingDuration,
  MIN_RANDOM_LOADING_MS,
  MAX_RANDOM_LOADING_MS,
} from '../src/utils/loadingUtils';
import { FullPageContentLoader } from '../src/components/common/FullPageContentLoader';

// Mock Theme
let mockIsDark = false;
jest.mock('../src/theme/theme', () => ({
  useAppTheme: () => ({
    isDark: mockIsDark,
    colors: {
      background: mockIsDark ? '#121212' : '#F8F9FA',
      card: mockIsDark ? '#1E1E1E' : '#FFFFFF',
      text: mockIsDark ? '#FFFFFF' : '#111827',
      textSecondary: mockIsDark ? '#AAAAAA' : '#6B7280',
      textMuted: mockIsDark ? '#777777' : '#9CA3AF',
      primary: '#2563EB',
      primaryText: '#FFFFFF',
      border: mockIsDark ? '#2D2D2D' : '#E5E7EB',
    },
  }),
}));

describe('Randomized Loading Duration (1–3 Seconds)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('generates a fresh integer between 1000 and 3000 ms inclusive', () => {
    for (let i = 0; i < 50; i++) {
      const duration = getRandomLoadingDuration();
      expect(duration).toBeGreaterThanOrEqual(MIN_RANDOM_LOADING_MS);
      expect(duration).toBeLessThanOrEqual(MAX_RANDOM_LOADING_MS);
      expect(Number.isInteger(duration)).toBe(true);
    }
  });

  it('starts the asynchronous task immediately upon invocation', async () => {
    let taskExecuted = false;
    const task = jest.fn(async () => {
      taskExecuted = true;
      return 'data-loaded';
    });

    const promise = withRandomLoadingDuration(task, 2000, 2000);
    // Task was invoked synchronously before any timer advances
    expect(task).toHaveBeenCalledTimes(1);
    expect(taskExecuted).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    const result = await promise;
    expect(result).toBe('data-loaded');
  });

  it('keeps loading visible until minimum randomized duration elapses for fast API requests', async () => {
    // Simulated fast API request taking 100ms
    const fastApiCall = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve('fast-response'), 100);
      });

    let resolved = false;
    const promise = withRandomLoadingDuration(fastApiCall, 2000, 2000);
    promise.then(() => {
      resolved = true;
    });

    // Advance 100ms: API request completes, but randomized 2000ms timer is not done
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(resolved).toBe(false);

    // Advance another 1800ms (total 1900ms): still not done
    await act(async () => {
      jest.advanceTimersByTime(1800);
    });
    expect(resolved).toBe(false);

    // Advance remaining 100ms (total 2000ms): resolves now
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(resolved).toBe(true);

    const result = await promise;
    expect(result).toBe('fast-response');
  });

  it('keeps loading visible until slow API request finishes when request exceeds minimum duration', async () => {
    // Simulated slow API request taking 3500ms (longer than 1-3s duration)
    const slowApiCall = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve('slow-response'), 3500);
      });

    let resolved = false;
    const promise = withRandomLoadingDuration(slowApiCall, 1500, 1500);
    promise.then(() => {
      resolved = true;
    });

    // Advance 1500ms (minimum display time reached, but API still in progress)
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(resolved).toBe(false);

    // Advance another 1900ms (total 3400ms): API still in flight
    await act(async () => {
      jest.advanceTimersByTime(1900);
    });
    expect(resolved).toBe(false);

    // Advance remaining 100ms (total 3500ms): API completes
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(resolved).toBe(true);

    const result = await promise;
    expect(result).toBe('slow-response');
  });

  it('respects minimum display duration before throwing when API request fails', async () => {
    const failedApiCall = () =>
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Network error')), 200);
      });

    let rejected = false;
    let caughtError: any = null;
    const promise = withRandomLoadingDuration(failedApiCall, 1800, 1800).catch((err) => {
      rejected = true;
      caughtError = err;
    });

    // Advance 200ms: error thrown internally, but loader must stay visible for min duration
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(rejected).toBe(false);

    // Advance to 1700ms: still waiting
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(rejected).toBe(false);

    // Advance to 1800ms: now rejects to caller so error UI can appear
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(rejected).toBe(true);
    expect(caughtError?.message).toBe('Network error');
  });
});

describe('FullPageContentLoader Component', () => {
  beforeEach(() => {
    mockIsDark = false;
  });

  it('renders centered large ActivityIndicator and exact screen message', () => {
    let testRenderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      testRenderer = ReactTestRenderer.create(
        <FullPageContentLoader message="Loading Products..." />
      );
    });

    const root = testRenderer.root;
    const spinner = root.findByType(ActivityIndicator);
    expect(spinner).toBeDefined();
    expect(spinner.props.size).toBe('large');

    const messageText = root.findByProps({ testID: 'full-page-content-loader-message' });
    expect(messageText.props.children).toBe('Loading Products...');
  });

  it('supports custom page-specific messages', () => {
    const messages = [
      'Loading Products...',
      'Loading your Orders...',
      'Loading Popular For You...',
      'Loading home...',
      'Loading categories...',
      'Loading wishlist...',
      'Loading cart...',
      'Loading Product Details...',
      'Loading order details...',
      'Loading notifications...',
      'Loading dashboard...',
      'Loading users...',
      'Loading Registrations...',
      'Loading Coupons...',
      'Loading reviews...',
      'Loading analytics...',
    ];

    messages.forEach((msg) => {
      let testRenderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        testRenderer = ReactTestRenderer.create(
          <FullPageContentLoader message={msg} />
        );
      });
      const messageText = testRenderer.root.findByProps({
        testID: 'full-page-content-loader-message',
      });
      expect(messageText.props.children).toBe(msg);
    });
  });

  it('supports overlay mode for pull-to-refresh without unmounting header or tabs', () => {
    let testRenderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      testRenderer = ReactTestRenderer.create(
        <FullPageContentLoader message="Loading Products..." overlay />
      );
    });
    const container = testRenderer.root.findByProps({ testID: 'full-page-content-loader' });
    const flatStyle = Object.assign({}, ...[].concat(container.props.style));

    expect(flatStyle.position).toBe('absolute');
    expect(flatStyle.top).toBe(0);
    expect(flatStyle.left).toBe(0);
    expect(flatStyle.right).toBe(0);
    expect(flatStyle.bottom).toBe(0);
    expect(flatStyle.zIndex).toBeGreaterThanOrEqual(999);
  });
});
