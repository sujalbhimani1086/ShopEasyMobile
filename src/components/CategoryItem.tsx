import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../theme/theme';
import { Icon, IconName } from './Icon';

export interface CategoryItemProps {
  name: string;
  icon?: IconName;
  isSelected: boolean;
  onSelect: (category: string) => void;
}

export const CATEGORY_ICON_NAMES: Record<string, IconName> = {
  All: 'sparkles',
  Accessories: 'gem',
  Bags: 'bag',
  Beauty: 'flower',
  Books: 'book',
  Clothing: 'shirt',
  Electronics: 'laptop',
  Footwear: 'shoe',
  'Home & Kitchen': 'utensils',
  Sports: 'activity',
  Toys: 'gamepad',
};

// Backward compatibility map
export const CATEGORY_ICONS: Record<string, string> = {
  All: 'sparkles',
  Accessories: 'gem',
  Bags: 'bag',
  Beauty: 'flower',
  Books: 'book',
  Clothing: 'shirt',
  Electronics: 'laptop',
  Footwear: 'shoe',
  'Home & Kitchen': 'utensils',
  Sports: 'activity',
  Toys: 'gamepad',
};

import { ScalePressable } from './animated';

export const CategoryItem: React.FC<CategoryItemProps> = React.memo(({
  name,
  icon,
  isSelected,
  onSelect,
}) => {
  const theme = useAppTheme();
  const iconName: IconName = icon || CATEGORY_ICON_NAMES[name] || 'tag';
  const iconColor = isSelected
    ? theme.colors.chipSelectedText
    : theme.colors.chipUnselectedText;

  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={`Category ${name}`}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected
            ? theme.colors.chipSelectedBg
            : theme.colors.chipUnselectedBg,
          borderColor: isSelected
            ? theme.colors.chipSelectedBg
            : theme.colors.border,
        },
      ]}
      activeScale={0.93}
      onPress={() => onSelect(name)}
    >
      <View style={styles.iconContainer}>
        <Icon name={iconName} size={15} color={iconColor} strokeWidth={2} />
      </View>
      <Text
        style={[
          styles.name,
          isSelected ? styles.nameSelected : styles.nameUnselected,
          {
            color: isSelected
              ? theme.colors.chipSelectedText
              : theme.colors.chipUnselectedText,
          },
        ]}
      >
        {name}
      </Text>
    </ScalePressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconContainer: {
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 13,
  },
  nameSelected: {
    fontWeight: '700',
  },
  nameUnselected: {
    fontWeight: '500',
  },
});




