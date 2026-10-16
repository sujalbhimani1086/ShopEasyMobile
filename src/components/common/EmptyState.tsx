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
import { Icon, IconName } from '../Icon';
import { FadeInView } from '../animated/FadeInView';
import { AppButton } from './AppButton';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  actionTitle?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'search',
  title,
  subtitle,
  actionTitle,
  actionIcon,
  onAction,
  style,
  titleStyle,
  subtitleStyle,
  children,
}) => {
  const theme = useAppTheme();

  return (
    <FadeInView duration={300} style={[styles.container, style]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.colors.surfaceSubtle },
        ]}
      >
        <Icon
          name={icon}
          size={40}
          color={theme.colors.textMuted}
          strokeWidth={2}
        />
      </View>

      <Text
        style={[
          styles.title,
          { color: theme.colors.text },
          titleStyle,
        ]}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { color: theme.colors.textSecondary },
            subtitleStyle,
          ]}
        >
          {subtitle}
        </Text>
      ) : null}

      {actionTitle && onAction ? (
        <AppButton
          title={actionTitle}
          onPress={onAction}
          rightIcon={actionIcon}
          size="md"
          fullWidth={false}
          style={styles.actionButton}
        />
      ) : null}

      {children}
    </FadeInView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 280,
  },
  actionButton: {
    paddingHorizontal: 24,
  },
});
