import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedback } from '../context/FeedbackContext';
import { Icon } from './Icon';

export interface HeaderProps {
  cartItemCount?: number;
  wishlistItemCount?: number;
  notificationCount?: number;
  onSearchPress?: () => void;
  onWishlistPress?: () => void;
  onCartPress?: () => void;
  onNotificationsPress?: () => void;
  onAccountPress?: () => void;
  isLoggedIn?: boolean;
  userName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  cartItemCount = 0,
  wishlistItemCount = 0,
  notificationCount = 0,
  onSearchPress,
  onWishlistPress,
  onCartPress,
  onNotificationsPress,
  onAccountPress,
  isLoggedIn = false,
  userName,
}) => {
  let insetsTop = 0;
  try {
    const insets = useSafeAreaInsets();
    insetsTop = insets?.top || 0;
  } catch {
    insetsTop = 0;
  }

  const feedback = useFeedback();

  const handleSearch = () => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      feedback.toast.info('Search feature coming soon');
    }
  };

  const handleWishlist = () => {
    if (onWishlistPress) {
      onWishlistPress();
    } else {
      feedback.toast.info('Wishlist feature coming soon');
    }
  };

  const handleCart = () => {
    if (onCartPress) {
      onCartPress();
    } else {
      feedback.toast.info('Cart feature coming soon');
    }
  };

  const handleAccount = () => {
    if (onAccountPress) {
      onAccountPress();
    } else {
      feedback.toast.info('Account feature coming soon');
    }
  };

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      (StatusBar as any).setBackgroundColor?.('#000000');
    }
  }, []);

  return (
    <View style={styles.headerWrapper}>
      {/* Coordinated status bar with pure black header */}
      <StatusBar barStyle="light-content" />

      {/* Top safe-area filler to eliminate white strips/gaps */}
      {insetsTop > 0 && <View style={[styles.safeAreaFiller, { height: insetsTop }]} />}

      {/* Main Header Container (Permanently Pure Black #000000 in both Dark & Light mode) */}
      <View style={styles.headerContainer}>
        {/* Exact Website Logo (white on pure black) */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../assets/logos/1logo-white.png')}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="ShopEasy"
          />
        </View>

        {/* Action Buttons in exact order: Search -> Wishlist -> Profile */}
        <View style={styles.actionsContainer}>
          {/* 1. Search Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search products"
            style={({ pressed }) => [
              styles.actionButton,
              {
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            onPress={handleSearch}
          >
            <Icon name="search" size={19} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>

          {/* 2. Wishlist Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Saved wishlist items"
            style={({ pressed }) => [
              styles.actionButton,
              {
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            onPress={handleWishlist}
          >
            <Icon
              name={wishlistItemCount > 0 ? 'heart-filled' : 'heart'}
              size={19}
              color={wishlistItemCount > 0 ? '#EF4444' : '#FFFFFF'}
              strokeWidth={2.2}
            />
            {wishlistItemCount > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: '#F59E0B' },
                ]}
              >
                <Text style={styles.badgeText}>
                  {wishlistItemCount > 99 ? '99+' : wishlistItemCount}
                </Text>
              </View>
            )}
          </Pressable>

          {/* 4. Notifications Button */}
          {onNotificationsPress && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isLoggedIn && typeof notificationCount === 'number' && notificationCount > 0
                  ? `Notifications, ${notificationCount > 99 ? '99 plus' : notificationCount} unread`
                  : 'Notifications'
              }
              style={({ pressed }) => [
                styles.actionButton,
                {
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={onNotificationsPress}
            >
              <Icon name="bell" size={19} color="#FFFFFF" strokeWidth={2.2} />
              {isLoggedIn &&
                typeof notificationCount === 'number' &&
                Number.isFinite(notificationCount) &&
                notificationCount > 0 && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: '#0EA5E9' },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </Text>
                  </View>
                )}
            </Pressable>
          )}

          {/* 5. Profile / Account Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isLoggedIn ? `Account (${userName || 'User'})` : 'Sign In'}
            style={({ pressed }) => [
              styles.actionButton,
              {
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            onPress={handleAccount}
          >
            <Icon name="user" size={19} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: '#000000',
    width: '100%',
  },
  safeAreaFiller: {
    backgroundColor: '#000000',
    width: '100%',
  },
  headerContainer: {
    height: 60,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 120,
    height: 38,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
