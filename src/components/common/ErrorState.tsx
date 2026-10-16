import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { Icon, IconName } from '../Icon';
import { AppButton } from './AppButton';

export interface ErrorStateProps {
  title?: string;
  message: string;
  icon?: IconName;
  onRetry?: () => void;
  retryText?: string;
  isCard?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  icon = 'alert-triangle',
  onRetry,
  retryText = 'Retry',
  isCard = false,
  style,
}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        isCard && [
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.borderLight,
          },
        ],
        style,
      ]}
    >
      <View style={styles.iconContainer}>
        <Icon name={icon} size={36} color={theme.colors.danger} strokeWidth={2} />
      </View>

      {title ? (
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
      ) : null}

      <Text
        style={[
          styles.message,
          { color: theme.colors.textSecondary },
        ]}
      >
        {message}
      </Text>

      {onRetry ? (
        <AppButton
          title={retryText}
          onPress={onRetry}
          variant="primary"
          size="sm"
          fullWidth={false}
          style={styles.retryBtn}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 280,
  },
  retryBtn: {
    minWidth: 110,
  },
});
