import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

export interface FadeInViewProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  slideDistance?: number;
  slideDirection?: 'up' | 'down' | 'left' | 'right' | 'none';
  style?: StyleProp<ViewStyle>;
}

export const FadeInView: React.FC<FadeInViewProps> = ({
  children,
  duration = 240,
  delay = 0,
  slideDistance = 12,
  slideDirection = 'up',
  style,
}) => {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    let isMounted = true;
    const animation = Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      isMounted = false;
      animation.stop();
    };
  }, [duration, delay, opacityAnim, translateAnim]);

  const getTransform = () => {
    if (slideDirection === 'none' || slideDistance === 0) return [];
    if (slideDirection === 'down') return [{ translateY: translateAnim.interpolate({ inputRange: [0, slideDistance], outputRange: [0, -slideDistance] }) }];
    if (slideDirection === 'left') return [{ translateX: translateAnim }];
    if (slideDirection === 'right') return [{ translateX: translateAnim.interpolate({ inputRange: [0, slideDistance], outputRange: [0, -slideDistance] }) }];
    // default 'up'
    return [{ translateY: translateAnim }];
  };

  return (
    <Animated.View
      style={[
        {
          opacity: opacityAnim,
          transform: getTransform(),
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};
