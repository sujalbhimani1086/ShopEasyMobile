import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';

export interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  style?: StyleProp<ViewStyle>;
  color?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'large',
  style,
  color,
}) => {
  const theme = useAppTheme();
  const spinnerColor = color || theme.colors.primary;

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={spinnerColor} />
      {message ? (
        <Text
          style={[
            styles.message,
            { color: theme.colors.textSecondary },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
