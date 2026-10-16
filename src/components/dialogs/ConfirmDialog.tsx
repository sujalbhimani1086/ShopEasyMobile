import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { IconName } from '../Icon';
import { AppDialog } from './AppDialog';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: IconName;
  iconColor?: string;
  iconBgColor?: string;
  cancelText?: string;
  confirmText?: string;
  confirmAccessibilityLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
  buttonLayout?: 'auto' | 'row' | 'column';
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  testID?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  icon,
  iconColor,
  iconBgColor,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  confirmAccessibilityLabel,
  isDestructive = true,
  loading = false,
  buttonLayout = 'auto',
  onCancel,
  onConfirm,
  testID,
}) => {
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const busy = loading || isSubmitting;

  const defaultIcon: IconName = icon || (isDestructive ? 'trash' : 'alert-circle');
  const defaultIconColor =
    iconColor || (isDestructive ? theme.colors.danger : theme.colors.primary);
  const defaultIconBgColor =
    iconBgColor ||
    (isDestructive
      ? theme.isDark
        ? 'rgba(239, 68, 68, 0.2)'
        : '#FEECEC'
      : theme.colors.surfaceSubtle);

  const handleConfirmPress = async () => {
    if (busy) return;
    try {
      setIsSubmitting(true);
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPress = () => {
    if (busy) return;
    onCancel();
  };

  const cancelLen = cancelText?.length || 0;
  const confirmLen = confirmText?.length || 0;
  const hasLongLabel = cancelLen > 13 || confirmLen > 13;

  // Use vertical stack when explicitly requested or on narrow viewports with long button labels
  const shouldStack =
    buttonLayout === 'column' ||
    (buttonLayout !== 'row' && windowWidth < 350 && hasLongLabel);

  // Allocate flexible width proportionally in horizontal row so long labels like "Continue Shopping" are never truncated
  const cancelFlex =
    !shouldStack && cancelLen > confirmLen * 1.3
      ? 1.35
      : !shouldStack && confirmLen > cancelLen * 1.3
      ? 0.95
      : 1;

  const confirmFlex =
    !shouldStack && cancelLen > confirmLen * 1.3
      ? 0.95
      : !shouldStack && confirmLen > cancelLen * 1.3
      ? 1.35
      : 1;

  const renderCancelButton = (fullWidth = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cancelText}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        styles.cancelButton,
        fullWidth ? styles.fullWidthButton : { flex: cancelFlex },
        {
          backgroundColor: theme.colors.surfaceSubtle,
          borderColor: theme.colors.border,
          opacity: busy ? 0.6 : pressed ? 0.75 : 1,
        },
      ]}
      onPress={handleCancelPress}
    >
      <Text
        style={[
          styles.cancelButtonText,
          { color: theme.colors.text },
        ]}
      >
        {cancelText}
      </Text>
    </Pressable>
  );

  const renderConfirmButton = (fullWidth = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={confirmAccessibilityLabel || confirmText}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        styles.confirmButton,
        fullWidth ? styles.fullWidthButton : { flex: confirmFlex },
        {
          backgroundColor: isDestructive
            ? theme.colors.danger
            : theme.colors.primary,
          opacity: busy ? 0.7 : pressed ? 0.85 : 1,
        },
      ]}
      onPress={handleConfirmPress}
    >
      {busy ? (
        <ActivityIndicator size="small" color={isDestructive ? '#FFFFFF' : theme.colors.primaryText} />
      ) : (
        <Text
          style={[
            styles.confirmButtonText,
            !isDestructive && { color: theme.colors.primaryText },
          ]}
        >
          {confirmText}
        </Text>
      )}
    </Pressable>
  );

  const footer = shouldStack ? (
    <View style={styles.buttonColumn}>
      {renderConfirmButton(true)}
      {renderCancelButton(true)}
    </View>
  ) : (
    <View style={styles.buttonRow}>
      {renderCancelButton(false)}
      {renderConfirmButton(false)}
    </View>
  );

  return (
    <AppDialog
      visible={visible}
      onClose={handleCancelPress}
      title={title}
      subtitle={message}
      icon={defaultIcon}
      iconColor={defaultIconColor}
      iconBgColor={defaultIconBgColor}
      closeOnBackdropPress={!busy}
      footer={footer}
      testID={testID}
      accessibilityLabel={title}
    />
  );
};

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  buttonColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
  },
  button: {
    height: 48,
    minHeight: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  fullWidthButton: {
    width: '100%',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    includeFontPadding: false,
  },
  confirmButton: {},
  confirmButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
    includeFontPadding: false,
  },
});
