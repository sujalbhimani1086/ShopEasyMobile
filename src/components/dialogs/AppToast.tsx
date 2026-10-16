import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/theme';
import { Icon, IconName } from '../Icon';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface AppToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'bottom';
  onDismiss?: () => void;
  testID?: string;
}

export const AppToast: React.FC<AppToastProps> = ({
  visible,
  message,
  type = 'success',
  duration = 3000,
  position = 'bottom',
  onDismiss,
  testID,
}) => {
  const theme = useAppTheme();
  let insets = { top: 0, bottom: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {}

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(position === 'top' ? -20 : 20)).current;

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;

    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        hideTimer = setTimeout(() => {
          handleDismiss();
        }, duration);
      }
    } else {
      opacityAnim.setValue(0);
      translateYAnim.setValue(position === 'top' ? -20 : 20);
    }

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [visible, duration]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: position === 'top' ? -20 : 20,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  if (!visible) return null;

  const getTypeConfig = () => {
    switch (type) {
      case 'error':
        return {
          icon: 'alert-circle' as IconName,
          accentColor: theme.colors.danger,
          iconBg: theme.isDark ? 'rgba(239, 68, 68, 0.25)' : '#FEECEC',
        };
      case 'warning':
        return {
          icon: 'alert-triangle' as IconName,
          accentColor: theme.colors.accent,
          iconBg: theme.isDark ? 'rgba(245, 158, 11, 0.25)' : '#FEF3C7',
        };
      case 'info':
        return {
          icon: 'info' as IconName,
          accentColor: theme.colors.primary,
          iconBg: theme.colors.surfaceSubtle,
        };
      case 'success':
      default:
        return {
          icon: 'check-circle' as IconName,
          accentColor: theme.colors.success,
          iconBg: theme.isDark ? 'rgba(16, 185, 129, 0.25)' : theme.colors.successBg,
        };
    }
  };

  const { icon, accentColor, iconBg } = getTypeConfig();

  const containerPositionStyle =
    position === 'top'
      ? { top: Math.max(16, insets.top + 10) }
      : { bottom: Math.max(20, insets.bottom + 65) };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlayWrapper,
        containerPositionStyle,
        {
          opacity: opacityAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
      testID={testID}
    >
      <Pressable
        onPress={handleDismiss}
        style={[
          styles.toastCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.borderLight,
          },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
          <Icon name={icon} size={18} color={accentColor} strokeWidth={2.4} />
        </View>
        <Text
          style={[styles.messageText, { color: theme.colors.text }]}
          numberOfLines={2}
        >
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          onPress={handleDismiss}
          style={styles.closeBtn}
        >
          <Icon name="close" size={14} color={theme.colors.textMuted} strokeWidth={2.2} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlayWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
