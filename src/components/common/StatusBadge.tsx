import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  tone,
  size = 'md',
  style,
  textStyle,
}) => {
  const theme = useAppTheme();

  // Automatic tone mapping if not explicitly provided
  const resolvedTone: BadgeTone = tone || (() => {
    const upper = label.toUpperCase();
    if (['DELIVERED', 'PAID', 'APPROVED', 'ACTIVE', 'IN STOCK', 'COMPLETED'].includes(upper)) {
      return 'success';
    }
    if (['PENDING', 'PROCESSING', 'SHIPPED', 'LOW STOCK'].includes(upper)) {
      return 'warning';
    }
    if (['CANCELLED', 'FAILED', 'REJECTED', 'OUT OF STOCK', 'DELETED'].includes(upper)) {
      return 'danger';
    }
    if (['ADMIN', 'COD', 'REFUNDED'].includes(upper)) {
      return 'info';
    }
    return 'neutral';
  })();

  let bg = theme.colors.surfaceSubtle;
  let text = theme.colors.text;

  switch (resolvedTone) {
    case 'success':
      bg = theme.isDark ? 'rgba(16, 185, 129, 0.16)' : '#E6F9F2';
      text = '#10B981';
      break;
    case 'warning':
      bg = theme.isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7';
      text = '#D97706';
      break;
    case 'danger':
      bg = theme.isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2';
      text = '#EF4444';
      break;
    case 'info':
      bg = theme.isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF';
      text = '#3B82F6';
      break;
    case 'neutral':
    default:
      bg = theme.colors.surfaceSubtle;
      text = theme.colors.textSecondary;
      break;
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 9,
          borderRadius: theme.radius.sm,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: text,
            fontSize: isSmall ? 11 : 12,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
