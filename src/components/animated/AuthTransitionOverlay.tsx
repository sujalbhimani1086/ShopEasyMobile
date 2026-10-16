import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  StatusBar,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';

export interface AuthTransitionOverlayProps {
  /** Whether the overlay is visible. */
  visible: boolean;
  /** Transition mode determines the displayed message. */
  mode: 'login' | 'logout';
  /** Called after the animation completes. The parent should navigate and hide the overlay. */
  onComplete: () => void;
  /** Total animation duration in milliseconds. Default ~1300ms. */
  duration?: number;
}

declare const process: { env?: { NODE_ENV?: string } } | undefined;

const USE_NATIVE_DRIVER =
  Platform.OS !== 'web' &&
  (typeof process === 'undefined' || process.env?.NODE_ENV !== 'test');

/**
 * Full-screen black transition overlay shown after a successful login or during logout.
 *
 * Visual design (matches ShopEasy web experience):
 * - Solid black background filling the entire screen edge-to-edge.
 * - Centered ShopEasy white logo with smooth fade-in + subtle scale-up.
 * - Contextual message ("Welcome to ShopEasy" / "Signing out...").
 * - Small activity indicator for a premium feel.
 * - After the hold phase, fades out smoothly and calls `onComplete`.
 *
 * Implementation notes:
 * - Uses React Native's built-in `Animated` API.
 * - Uses stable `onCompleteRef` to prevent re-render cancellation bugs.
 * - Uses transparent Modal with absoluteFill to reliably render on top of any screen on Android.
 */
export const AuthTransitionOverlay: React.FC<AuthTransitionOverlayProps> = ({
  visible,
  mode,
  onComplete,
  duration = 1300,
}) => {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  const completedRef = useRef(false);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Keep a ref to onComplete so parent re-renders don't recreate runAnimation
  // or trigger the useEffect cleanup that stops the running animation
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const message = mode === 'login' ? 'Welcome to ShopEasy' : 'Signing out...';

  const runAnimation = useCallback(() => {
    completedRef.current = false;

    // Reset values to initial state
    logoOpacity.setValue(0);
    logoScale.setValue(0.85);
    textOpacity.setValue(0);
    overlayOpacity.setValue(1);

    // Phase timings:
    // Fade-in: ~350ms (logo & text enter smoothly)
    // Hold: ~600ms (user clearly sees the black screen and logo)
    // Fade-out: ~350ms (overlay smoothly fades out to reveal next screen)
    const fadeInDuration = Math.round(duration * 0.28);
    const holdDuration = Math.round(duration * 0.44);
    const fadeOutDuration = Math.round(duration * 0.28);

    const animation = Animated.sequence([
      // Phase 1: Fade in logo + scale up + fade in text
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: fadeInDuration,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: fadeInDuration,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: fadeInDuration,
          delay: Math.round(fadeInDuration * 0.35),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),

      // Phase 2 + 3: Hold via delay inside timing, then fade out entire overlay
      // (This avoids Animated.delay which can break on native driver in sequence)
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: fadeOutDuration,
        delay: holdDuration,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    animationRef.current = animation;

    animation.start(({ finished }) => {
      if (finished && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    });
  }, [duration, logoOpacity, logoScale, textOpacity, overlayOpacity]);

  useEffect(() => {
    if (visible) {
      runAnimation();
    } else {
      animationRef.current?.stop();
    }

    return () => {
      // Cleanup on unmount only
      animationRef.current?.stop();
    };
  }, [visible, runAnimation]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        // Prevent back press during animation
      }}
    >
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.container, { opacity: overlayOpacity }]}>
        {/* Centered content */}
        <View style={styles.content}>
          {/* Logo with fade + scale */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require('../../assets/logos/1logo-white.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Message text */}
          <Animated.Text style={[styles.messageText, { opacity: textOpacity }]}>
            {message}
          </Animated.Text>

          {/* Subtle spinner */}
          <Animated.View style={{ opacity: textOpacity, marginTop: 24 }}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 120,
  },
  messageText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
