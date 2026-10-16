import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { Icon, IconName } from '../Icon';

export interface AppDialogProps {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  iconBgColor?: string;
  closeOnBackdropPress?: boolean;
  showCloseButton?: boolean;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  testID?: string;
  accessibilityLabel?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const AppDialog: React.FC<AppDialogProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  iconColor,
  iconBgColor,
  closeOnBackdropPress = true,
  showCloseButton = false,
  children,
  footer,
  maxWidth = 380,
  testID,
  accessibilityLabel,
}) => {
  const theme = useAppTheme();
  const scaleAnim = useRef(new Animated.Value(0.93)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.93);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleBackdropPress = () => {
    if (closeOnBackdropPress && onClose) {
      onClose();
    }
  };

  const resolvedIconColor = iconColor || theme.colors.primary;
  const resolvedIconBgColor =
    iconBgColor || theme.colors.surfaceSubtle;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
      accessibilityLabel={accessibilityLabel || title}
    >
      <View style={styles.overlay}>
        {/* Semi-transparent Dimmed Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={handleBackdropPress}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog overlay"
        />

        {/* Modal Dialog Card Container */}
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.borderLight,
              maxWidth: Math.min(maxWidth, SCREEN_WIDTH - 36),
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Optional Top Right Close Button */}
          {showCloseButton && onClose && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              style={[
                styles.closeButton,
                { backgroundColor: theme.colors.surfaceSubtle },
              ]}
              onPress={onClose}
            >
              <Icon name="close" size={16} color={theme.colors.textMuted} strokeWidth={2.4} />
            </Pressable>
          )}

          {/* Dialog Header / Icon */}
          {icon && (
            <View
              style={[
                styles.iconWrapper,
                {
                  backgroundColor: resolvedIconBgColor,
                },
              ]}
            >
              <Icon name={icon} size={28} color={resolvedIconColor} strokeWidth={2.2} />
            </View>
          )}

          {/* Dialog Title */}
          {title ? (
            <Text
              style={[
                styles.title,
                { color: theme.colors.text },
                icon ? styles.textCenter : styles.textLeft,
              ]}
            >
              {title}
            </Text>
          ) : null}

          {/* Dialog Subtitle / Message */}
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                { color: theme.colors.textSecondary },
                icon ? styles.textCenter : styles.textLeft,
              ]}
            >
              {subtitle}
            </Text>
          ) : null}

          {/* Dialog Custom Body Content */}
          {children && (
            <ScrollView
              style={styles.bodyScrollView}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
          )}

          {/* Dialog Footer Actions */}
          {footer && <View style={styles.footerContainer}>{footer}</View>}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    paddingHorizontal: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialogContainer: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconWrapper: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  textCenter: {
    textAlign: 'center',
  },
  textLeft: {
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  bodyScrollView: {
    maxHeight: SCREEN_HEIGHT * 0.42,
    width: '100%',
    marginBottom: 16,
  },
  bodyContent: {
    paddingVertical: 4,
  },
  footerContainer: {
    width: '100%',
    marginTop: 4,
  },
});
