import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { IconName } from '../Icon';
import { AppDialog } from './AppDialog';

export type AlertType = 'info' | 'warning' | 'success' | 'error';

export interface AlertDialogProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message: string;
  buttonText?: string;
  icon?: IconName;
  iconColor?: string;
  iconBgColor?: string;
  onClose: () => void;
  testID?: string;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  visible,
  type = 'info',
  title,
  message,
  buttonText = 'OK',
  icon,
  iconColor,
  iconBgColor,
  onClose,
  testID,
}) => {
  const theme = useAppTheme();

  const getStyleForType = () => {
    switch (type) {
      case 'success':
        return {
          icon: (icon || 'check-circle') as IconName,
          iconColor: iconColor || theme.colors.success,
          iconBgColor:
            iconBgColor ||
            (theme.isDark ? 'rgba(16, 185, 129, 0.2)' : theme.colors.successBg),
          btnColor: theme.colors.success,
          textColor: '#FFFFFF',
        };
      case 'error':
        return {
          icon: (icon || 'alert-circle') as IconName,
          iconColor: iconColor || theme.colors.danger,
          iconBgColor:
            iconBgColor ||
            (theme.isDark ? 'rgba(239, 68, 68, 0.2)' : theme.colors.dangerBg),
          btnColor: theme.colors.danger,
          textColor: '#FFFFFF',
        };
      case 'warning':
        return {
          icon: (icon || 'alert-triangle') as IconName,
          iconColor: iconColor || theme.colors.accent,
          iconBgColor:
            iconBgColor ||
            (theme.isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7'),
          btnColor: theme.colors.accent,
          textColor: '#FFFFFF',
        };
      case 'info':
      default:
        return {
          icon: (icon || 'info') as IconName,
          iconColor: iconColor || theme.colors.primary,
          iconBgColor:
            iconBgColor || theme.colors.surfaceSubtle,
          btnColor: theme.colors.primary,
          textColor: theme.colors.primaryText,
        };
    }
  };

  const styleConfig = getStyleForType();

  const footer = (
    <View style={styles.buttonWrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={buttonText}
        style={({ pressed }) => [
          styles.actionButton,
          {
            backgroundColor: styleConfig.btnColor,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={onClose}
      >
        <Text
          style={[
            styles.actionButtonText,
            { color: styleConfig.textColor },
          ]}
          numberOfLines={1}
        >
          {buttonText}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <AppDialog
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={message}
      icon={styleConfig.icon}
      iconColor={styleConfig.iconColor}
      iconBgColor={styleConfig.iconBgColor}
      footer={footer}
      testID={testID}
      accessibilityLabel={title}
    />
  );
};

const styles = StyleSheet.create({
  buttonWrapper: {
    width: '100%',
  },
  actionButton: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
