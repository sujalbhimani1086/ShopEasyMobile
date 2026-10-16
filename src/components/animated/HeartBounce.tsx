import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

export interface HeartBounceProps {
  isFilled: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const HeartBounce: React.FC<HeartBounceProps> = ({
  isFilled,
  children,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.35,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFilled, scaleAnim]);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      {children}
    </Animated.View>
  );
};
