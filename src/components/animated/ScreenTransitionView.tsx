import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle, StyleSheet } from 'react-native';

export interface ScreenTransitionViewProps {
  routeKey: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const ScreenTransitionView: React.FC<ScreenTransitionViewProps> = ({
  routeKey,
  children,
  style,
}) => {
  const opacityAnim = useRef(new Animated.Value(0.2)).current;
  const translateYAnim = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    opacityAnim.setValue(0.2);
    translateYAnim.setValue(6);

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [routeKey, opacityAnim, translateYAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ translateY: translateYAnim }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
