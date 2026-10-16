import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from 'react-native';

export interface ScalePressableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  duration?: number;
}

/**
 * ScalePressable provides subtle, tactile micro-interaction feedback on touch.
 * Runs on the native UI thread using native driver (zero JS thread overhead).
 */
export const ScalePressable: React.FC<ScalePressableProps> = ({
  children,
  style,
  activeScale = 0.96,
  duration = 120,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    if (!disabled) {
      Animated.timing(scaleAnim, {
        toValue: activeScale,
        duration,
        useNativeDriver: true,
      }).start();
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
    onPressOut?.(e);
  };

  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
