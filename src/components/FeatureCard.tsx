import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme/theme';
import { Icon, IconName } from './Icon';

export interface ShopFeature {
  iconName: IconName;
  iconColor: string;
  title: string;
  description: string;
}

export const SHOP_FEATURES: ShopFeature[] = [
  {
    iconName: 'truck',
    iconColor: '#000000',
    title: 'Fast Delivery',
    description: 'Free delivery on all orders with no minimum purchase required.',
  },
  {
    iconName: 'shield-check',
    iconColor: '#10B981',
    title: 'Secure Payment',
    description: 'Your transactions are protected with end-to-end encryption.',
  },
  {
    iconName: 'refresh',
    iconColor: '#F59E0B',
    title: 'Easy Returns',
    description: 'Hassle-free returns within 30 days of your purchase.',
  },
];

export const WhyShopEasySection: React.FC = () => {
  const theme = useAppTheme();

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Why ShopEasy?
        </Text>
        <Text
          style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}
        >
          Your trusted destination for premium online shopping
        </Text>
      </View>

      <View style={styles.cardsRow}>
        {SHOP_FEATURES.map((feature, index) => (
          <View
            key={index}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: theme.colors.surfaceSubtle },
              ]}
            >
              <Icon
                name={feature.iconName}
                size={22}
                color={theme.colors.primary}
                strokeWidth={2.2}
              />
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {feature.title}
            </Text>
            <Text
              style={[
                styles.description,
                { color: theme.colors.textMuted },
              ]}
              numberOfLines={3}
            >
              {feature.description}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    textAlign: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  description: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
});
