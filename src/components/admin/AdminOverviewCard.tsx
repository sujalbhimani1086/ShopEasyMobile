import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { Icon } from '../Icon';

export interface AdminOverviewCardProps {
  title: string;
  value: number | string;
  description: string;
  icon: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const AdminOverviewCard: React.FC<AdminOverviewCardProps> = ({
  title,
  value,
  description,
  icon,
  onPress,
  testID,
  accessibilityLabel,
  loading = false,
  style,
}) => {
  const theme = useAppTheme();
  const lastPressTimeRef = useRef(0);

  const handlePress = () => {
    const now = Date.now();
    // Guard against rapid duplicate taps (400ms debounce)
    if (now - lastPressTimeRef.current < 400) {
      return;
    }
    lastPressTimeRef.current = now;
    onPress();
  };

  const formattedValue =
    typeof value === 'number'
      ? value.toLocaleString('en-IN')
      : value || '0';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel || `${title}: ${formattedValue}, ${description}`
      }
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF',
          borderColor: theme.isDark ? '#2C2C2E' : '#E5E7EB',
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {/* Top Row: Uppercase Title & Black Rounded-Square Icon Box */}
      <View style={styles.topRow}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: theme.colors.textMuted }]}
        >
          {title.toUpperCase()}
        </Text>
        <View style={styles.iconContainer}>
          <Icon name={icon} size={15} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      </View>

      {/* Metric Value: Large Prominent Number */}
      <View style={styles.valueRow}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={theme.isDark ? '#FFFFFF' : '#000000'}
            style={styles.loader}
          />
        ) : (
          <Text
            numberOfLines={1}
            style={[styles.value, { color: theme.colors.text }]}
          >
            {formattedValue}
          </Text>
        )}
      </View>

      {/* Bottom Row: Description Pill & Right Arrow */}
      <View style={styles.bottomRow}>
        <View
          style={[
            styles.descPill,
            {
              backgroundColor: theme.isDark ? '#262629' : '#F3F4F6',
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.descText, { color: theme.colors.textSecondary }]}
          >
            {description}
          </Text>
        </View>
        <View style={styles.arrowBox}>
          <Icon
            name="chevron-right"
            size={14}
            color={theme.colors.textMuted}
            strokeWidth={2.4}
          />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minHeight: 122,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    flex: 1,
    marginRight: 6,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueRow: {
    marginVertical: 4,
    justifyContent: 'center',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  loader: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  descPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: '82%',
  },
  descText: {
    fontSize: 11,
    fontWeight: '600',
  },
  arrowBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
