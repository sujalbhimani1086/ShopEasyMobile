import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { Icon, IconName } from './Icon';
import { BadgeBounce } from './animated';

export type BottomNavTab = 'home' | 'products' | 'categories' | 'orders' | 'cart';

export interface BottomNavigationProps {
  activeTab: BottomNavTab;
  onTabSelect: (tab: BottomNavTab) => void;
  cartItemCount?: number;
}

interface TabConfig {
  key: BottomNavTab;
  label: string;
  iconName: IconName;
}

const TABS: TabConfig[] = [
  { key: 'home', label: 'Home', iconName: 'home' },
  { key: 'products', label: 'Products', iconName: 'bag' },
  { key: 'categories', label: 'Categories', iconName: 'categories' },
  { key: 'orders', label: 'My Orders', iconName: 'orders' },
  { key: 'cart', label: 'Cart', iconName: 'cart' },
];

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabSelect,
  cartItemCount = 0,
}) => {
  const theme = useAppTheme();
  let insetsBottom = 0;
  try {
    const insets = useSafeAreaInsets();
    insetsBottom = insets?.bottom || 0;
  } catch {
    insetsBottom = 0;
  }

  const activeColor = theme.isDark ? '#FFFFFF' : '#000000';
  const inactiveColor = theme.isDark ? '#888888' : '#666666';

  return (
    <View
      style={[
        styles.navContainer,
        {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          paddingBottom: Math.max(insetsBottom, 6),
        },
      ]}
    >
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const tintColor = isActive ? activeColor : inactiveColor;
          const showCartBadge = tab.key === 'cart' && cartItemCount > 0;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
              style={({ pressed }) => [
                styles.tabItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => onTabSelect(tab.key)}
            >
              {/* Active Tab Top Indicator Pill */}
              {isActive && (
                <View
                  style={[
                    styles.activeIndicatorPill,
                    { backgroundColor: activeColor },
                  ]}
                />
              )}

              {/* Vector Icon with optional Badge */}
              <View style={styles.iconWrapper}>
                <Icon
                  name={tab.iconName}
                  size={21}
                  color={tintColor}
                  strokeWidth={isActive ? 2.3 : 1.9}
                />
                {showCartBadge && (
                  <BadgeBounce count={cartItemCount} style={styles.cartBadgeWrapper}>
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText} numberOfLines={1}>
                        {cartItemCount > 99 ? '99+' : cartItemCount}
                      </Text>
                    </View>
                  </BadgeBounce>
                )}
              </View>

              {/* Label */}
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: tintColor,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    borderTopWidth: 1,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 56,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  activeIndicatorPill: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  iconWrapper: {
    marginBottom: 2,
    height: 24,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadgeWrapper: {
    position: 'absolute',
    top: -3,
    right: -2,
    zIndex: 10,
  },
  cartBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
    textAlign: 'center',
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
