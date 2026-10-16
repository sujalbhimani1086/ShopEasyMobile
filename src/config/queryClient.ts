import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// React Native foreground focus sync
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

AppState.addEventListener('change', onAppStateChange);

/**
 * Remove / clear sensitive user and session queries upon logout or account switching.
 * Guarantees that data from a previous session does not leak into another user session.
 */
export function clearUserQueryCache(): void {
  queryClient.clear();
}
