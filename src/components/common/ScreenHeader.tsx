import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { Icon, IconName } from '../Icon';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: IconName;
  backAccessibilityLabel?: string;
  rightAction?: React.ReactNode;
  rightActionText?: string;
  rightActionIcon?: IconName;
  onRightAction?: () => void;
  rightActionAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  showBorder?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backIcon = 'arrow-left',
  backAccessibilityLabel = 'Go back',
  rightAction,
  rightActionText,
  rightActionIcon,
  onRightAction,
  rightActionAccessibilityLabel,
  style,
  titleStyle,
  showBorder = true,
}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: theme.colors.card,
          borderBottomColor: showBorder ? theme.colors.borderLight : 'transparent',
          borderBottomWidth: showBorder ? 1 : 0,
        },
        style,
      ]}
    >
      <View style={styles.leftGroup}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name={backIcon} size={18} color={theme.colors.text} strokeWidth={2.4} />
          </Pressable>
        ) : null}

        <View style={styles.titleContainer}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: theme.colors.text }, titleStyle]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: theme.colors.textSecondary }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.rightGroup}>
        {rightAction ? (
          rightAction
        ) : rightActionText || rightActionIcon ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rightActionAccessibilityLabel || rightActionText}
            onPress={onRightAction}
            style={({ pressed }) => [
              styles.actionButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {rightActionIcon && (
              <Icon
                name={rightActionIcon}
                size={18}
                color={theme.colors.primary}
                strokeWidth={2}
              />
            )}
            {rightActionText && (
              <Text style={[styles.actionText, { color: theme.colors.primary }]}>
                {rightActionText}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
