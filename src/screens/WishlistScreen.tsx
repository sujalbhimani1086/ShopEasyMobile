import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useWishlist } from '../context/WishlistContext';
import { ProductCard } from '../components/ProductCard';
import type { Product } from '../types/product';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/dialogs';
import { ScreenHeader, EmptyState, FullScreenRefreshLoader, FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 12;
const GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GAP) / 2;

export interface WishlistScreenProps {
  onBack: () => void;
  onProductPress?: (productId: number) => void;
  onAddToCart?: (product: Product) => void;
  onStartShopping?: () => void;
}

export const WishlistScreen: React.FC<WishlistScreenProps> = ({
  onBack,
  onProductPress,
  onAddToCart,
  onStartShopping,
}) => {
  const theme = useAppTheme();
  const { wishlistItems, wishlistCount, clearWishlist, refreshWishlist } = useWishlist();
  const [isClearWishlistVisible, setIsClearWishlistVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await withRandomLoadingDuration(() => refreshWishlist());
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refreshWishlist]);

  const handleClearAll = () => {
    if (wishlistItems.length === 0) return;
    setIsClearWishlistVisible(true);
  };

  const renderEmptyState = () => (
    <EmptyState
      icon="heart"
      title="Your wishlist is empty"
      subtitle="Explore products and tap the heart icon to save your favorite items here for easy access later."
      actionTitle="Explore Products"
      actionIcon="chevron-right"
      onAction={onStartShopping || onBack}
    />
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Screen Header Bar */}
      <ScreenHeader
        title="Wishlist"
        subtitle={`${wishlistCount} ${wishlistCount === 1 ? 'saved item' : 'saved items'}`}
        onBack={onBack}
        rightAction={
          wishlistCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all items from wishlist"
              style={({ pressed }) => [
                styles.clearAllBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleClearAll}
            >
              <Text style={[styles.clearAllText, { color: theme.colors.danger }]}>
                Clear
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* Main Grid Content */}
      <View style={styles.contentWrapper}>
        <FlatList
          data={wishlistItems}
          keyExtractor={(item) => `wishlist-${item.id}`}
          numColumns={2}
          contentContainerStyle={
            wishlistItems.length === 0
              ? styles.emptyListContent
              : styles.gridContent
          }
          columnWrapperStyle={
            wishlistItems.length > 0 ? styles.columnWrapper : undefined
          }
          ListEmptyComponent={renderEmptyState}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              cardWidth={CARD_WIDTH}
              onPress={(p) => onProductPress?.(p.id)}
              onAddToCart={onAddToCart}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['transparent']}
              tintColor="transparent"
              progressBackgroundColor="transparent"
            />
          }
          showsVerticalScrollIndicator={false}
        />
        {refreshing && (
          <FullPageContentLoader
            message="Loading wishlist..."
            overlay
          />
        )}
      </View>

      <ConfirmDialog
        visible={isClearWishlistVisible}
        title="Clear Wishlist?"
        message="Are you sure you want to remove all saved items from your wishlist?"
        icon="trash"
        cancelText="Keep Items"
        confirmText="Clear All"
        isDestructive={true}
        onCancel={() => setIsClearWishlistVisible(false)}
        onConfirm={() => {
          clearWishlist();
          setIsClearWishlistVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  headerBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  clearAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 12,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    maxWidth: 320,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyHeartIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreBtn: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
  },
  exploreBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
