import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { ScalePressable } from '../animated/ScalePressable';
import { Icon, IconName } from '../Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
  iconSize?: number;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  disabled = false,
  leftIcon,
  rightIcon,
  iconSize,
  fullWidth = true,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;

  // Resolve sizes
  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, iconSize: 14, radius: theme.radius.sm },
    md: { paddingVertical: 12, paddingHorizontal: 16, fontSize: 14, iconSize: 16, radius: theme.radius.md },
    lg: { paddingVertical: 15, paddingHorizontal: 20, fontSize: 16, iconSize: 18, radius: theme.radius.lg },
  }[size];

  const effectiveIconSize = iconSize || sizeStyles.iconSize;

  // Resolve variant styles
  let backgroundColor: string = theme.colors.primary;
  let textColor: string = theme.colors.primaryText;
  let borderColor: string | undefined = undefined;
  let borderWidth: number = 0;

  switch (variant) {
    case 'secondary':
      backgroundColor = theme.colors.surfaceSubtle;
      textColor = theme.colors.text;
      break;
    case 'outline':
      backgroundColor = 'transparent';
      textColor = theme.colors.text;
      borderColor = theme.colors.border;
      borderWidth = 1;
      break;
    case 'danger':
      backgroundColor = theme.colors.danger;
      textColor = '#FFFFFF';
      break;
    case 'ghost':
      backgroundColor = 'transparent';
      textColor = theme.colors.primary;
      break;
    case 'primary':
    default:
      backgroundColor = theme.colors.primary;
      textColor = theme.colors.primaryText;
      break;
  }

  if (isDisabled) {
    if (variant === 'outline' || variant === 'ghost') {
      borderColor = theme.colors.borderLight;
      textColor = theme.colors.textMuted;
    } else {
      backgroundColor = theme.colors.surfaceSubtle;
      textColor = theme.colors.textMuted;
    }
  }

  const displayText = loading && loadingText ? loadingText : title;

  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      activeScale={isDisabled ? 1 : 0.97}
      onPress={onPress}
      style={[
        styles.buttonBase,
        {
          backgroundColor,
          borderRadius: sizeStyles.radius,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderWidth,
          borderColor,
          width: fullWidth ? '100%' : 'auto',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={textColor}
            style={styles.spinner}
          />
        ) : leftIcon ? (
          <View style={styles.leftIconContainer}>
            <Icon
              name={leftIcon}
              size={effectiveIconSize}
              color={textColor}
              strokeWidth={2.4}
            />
          </View>
        ) : null}

        <Text
          numberOfLines={1}
          style={[
            styles.buttonText,
            {
              color: textColor,
              fontSize: sizeStyles.fontSize,
            },
            textStyle,
          ]}
        >
          {displayText}
        </Text>

        {!loading && rightIcon && (
          <View style={styles.rightIconContainer}>
            <Icon
              name={rightIcon}
              size={effectiveIconSize}
              color={textColor}
              strokeWidth={2.4}
            />
          </View>
        )}
      </View>
    </ScalePressable>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  leftIconContainer: {
    marginRight: 8,
  },
  rightIconContainer: {
    marginLeft: 8,
  },
});
