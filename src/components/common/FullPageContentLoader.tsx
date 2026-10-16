import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Animated,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';

export interface FullPageContentLoaderProps {
  /** Page-specific message displayed below the spinner (e.g. "Loading Products...", "Loading your Orders...") */
  message?: string;
  /** Title alias for message to maintain compatibility */
  title?: string;
  /** Optional secondary subtitle */
  subtitle?: string;
  /** Size of the spinner indicator ('large' | 'small'), defaults to 'large' */
  size?: 'small' | 'large';
  /** Optional custom spinner color override (defaults to theme.colors.primary) */
  color?: string;
  /** When true, renders as an absolute overlay within the parent content area */
  overlay?: boolean;
  /** Test identifier */
  testID?: string;
  /** Optional custom styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * FullPageContentLoader
 *
 * Consistent, reusable full-content-area loading experience across all customer
 * and admin screens in ShopEasy Mobile.
 *
 * Renders a centered spinner with a page-specific message directly below it,
 * filling the available content area between the header and bottom navigation.
 */
export const FullPageContentLoader: React.FC<FullPageContentLoaderProps> = ({
  message,
  title,
  subtitle,
  size = 'large',
  color,
  overlay = false,
  testID = 'full-page-content-loader',
  style,
}) => {
  const theme = useAppTheme();
  const spinnerColor = color || theme.colors.primary;
  const displayMessage = message || title || 'Loading...';

  // Smooth entrance transition matching existing animations
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0.7);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={displayMessage}
      pointerEvents={overlay ? 'auto' : undefined}
      style={[
        overlay ? styles.overlay : styles.container,
        { backgroundColor: theme.colors.background },
        style,
      ]}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          opacity: fadeAnim,
        }}
      >
        <ActivityIndicator
          testID={`${testID}-spinner`}
          size={size}
          color={spinnerColor}
        />
        {displayMessage ? (
          <Text
            testID={`${testID}-message`}
            style={[
              styles.message,
              { color: theme.colors.textSecondary },
            ]}
          >
            {displayMessage}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            testID={`${testID}-subtitle`}
            style={[
              styles.subtitle,
              { color: theme.colors.textMuted },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999,
    elevation: 6,
  },
  message: {
    fontSize: 14,
    marginTop: 14,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '400',
    textAlign: 'center',
  },
});
