import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../config/queryKeys';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { useFeedback } from '../../context/FeedbackContext';
import { Icon } from '../../components/Icon';
import { resolveImageUrl, FALLBACK_PRODUCT_IMAGE } from '../../config/api';
import type { AdminReview } from '../../types/admin';
import { getAdminReviews, deleteAdminReview } from '../../services/adminApi';
import { FullPageContentLoader } from '../../components/common';

interface AdminReviewsViewProps {
  token: string;
}

export const AdminReviewsView: React.FC<AdminReviewsViewProps> = ({ token }) => {
  const theme = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const {
    data,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.adminReviews(page, search, ratingFilter),
    queryFn: async () => {
      return await getAdminReviews(token, page, 20, search, ratingFilter);
    },
    enabled: !!token,
  });

  const reviews = data?.reviews || [];
  const totalCount = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err: any) {
      feedback.toast.error(err.message || 'Could not refresh reviews');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteReview = (review: AdminReview) => {
    feedback.showConfirm({
      title: 'Delete Review',
      message: `Are you sure you want to delete this review by "${review.userName}" for "${review.productName}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteAdminReview(token, review.id);
          queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.reviews(review.productId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
          feedback.toast.success('Review deleted successfully');
        } catch (err: any) {
          feedback.toast.error(err.message || 'Failed to delete review');
        }
      },
    });
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= rating ? 'star-filled' : 'star'}
          size={14}
          color={i <= rating ? '#F59E0B' : '#D1D5DB'}
        />
      );
    }
    return <View style={styles.starRow}>{stars}</View>;
  };

  if (loading && reviews.length === 0 && !refreshing) {
    return <FullPageContentLoader message="Loading reviews..." />;
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.topBar}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.isDark ? '#1C1C1E' : '#F4F4F6',
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search by reviewer, product, or comment..."
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Icon name="close" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Rating Filters */}
      <View style={styles.chipScrollContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['ALL', '5', '4', '3', '2', '1']}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.chipList}
          renderItem={({ item }) => {
            const isSelected = ratingFilter === item;
            return (
              <Pressable
                onPress={() => setRatingFilter(item)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? theme.isDark
                        ? '#FFFFFF'
                        : '#000000'
                      : theme.isDark
                      ? '#222224'
                      : '#EEEEEE',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected
                        ? theme.isDark
                          ? '#000000'
                          : '#FFFFFF'
                        : theme.colors.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {item === 'ALL' ? 'All Ratings' : `★ ${item}`}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Reviews List */}
      <View style={{ flex: 1, position: 'relative' }}>
        <FlatList
          data={reviews}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <Text style={[styles.countHeader, { color: theme.colors.textMuted }]}>
            Showing {reviews.length} of {totalCount} reviews
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="star" size={48} color={theme.colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Reviews Found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              {search ? 'Try clearing your search query' : 'Customer product ratings will appear here'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const reviewDate = new Date(item.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          return (
            <View
              style={[
                styles.reviewCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {/* Product Info Row */}
              <View style={styles.productRow}>
                <Image
                  source={{ uri: resolveImageUrl(item.productImage) }}
                  defaultSource={{ uri: FALLBACK_PRODUCT_IMAGE }}
                  style={styles.productThumb}
                  resizeMode="cover"
                />
                <View style={styles.productMeta}>
                  <Text style={[styles.productName, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={[styles.productId, { color: theme.colors.textMuted }]}>
                    Product #{item.productId}
                  </Text>
                </View>

                <Pressable
                  style={[styles.deleteBtn, { backgroundColor: '#FEE2E2' }]}
                  onPress={() => handleDeleteReview(item)}
                >
                  <Icon name="trash" size={14} color="#DC2626" />
                </Pressable>
              </View>

              {/* Reviewer & Rating Header */}
              <View
                style={[
                  styles.reviewerBox,
                  {
                    backgroundColor: theme.isDark ? '#1C1C1E' : '#F9FAFB',
                    borderColor: theme.colors.borderLight,
                  },
                ]}
              >
                <View style={styles.reviewerTop}>
                  <View style={styles.reviewerInfo}>
                    <Text style={[styles.reviewerName, { color: theme.colors.text }]}>
                      {item.userName}
                    </Text>
                    <Text style={[styles.reviewerEmail, { color: theme.colors.textMuted }]}>
                      {item.userEmail}
                    </Text>
                  </View>
                  <View style={styles.ratingBox}>
                    {renderStars(item.rating)}
                    <Text style={[styles.dateText, { color: theme.colors.textMuted }]}>
                      {reviewDate}
                    </Text>
                  </View>
                </View>

                {item.isVerifiedBuyer && (
                  <View style={styles.verifiedRow}>
                    <Icon name="check-circle" size={12} color="#15803D" />
                    <Text style={styles.verifiedText}>Verified Buyer</Text>
                  </View>
                )}

                {/* Comment Text */}
                <Text style={[styles.commentText, { color: theme.colors.text }]}>
                  "{item.comment}"
                </Text>
              </View>
            </View>
          );
        }}
      />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  chipScrollContainer: {
    paddingBottom: 8,
  },
  chipList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 12,
  },
  countHeader: {
    fontSize: 12,
    marginBottom: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  productMeta: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
  },
  productId: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  reviewerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  reviewerEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  ratingBox: {
    alignItems: 'flex-end',
    gap: 2,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  dateText: {
    fontSize: 10,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  commentText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 2,
  },
});
