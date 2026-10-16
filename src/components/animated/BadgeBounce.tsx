import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

export interface BadgeBounceProps {
  count: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const BadgeBounce: React.FC<BadgeBounceProps> = ({
  count,
  children,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    if (prevCount.current !== count && count > 0) {
      prevCount.current = count;
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.28,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 110,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      prevCount.current = count;
    }
  }, [count, scaleAnim]);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      {children}
    </Animated.View>
  );
};
