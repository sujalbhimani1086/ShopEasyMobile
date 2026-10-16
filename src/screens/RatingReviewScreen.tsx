import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { queryClient } from '../config/queryClient';
import { queryKeys } from '../config/queryKeys';
import { Icon } from '../components/Icon';
import { AlertDialog, type AlertType } from '../components/dialogs';
import { ScalePressable } from '../components/animated';
import { resolveImageUrl, FALLBACK_PRODUCT_IMAGE } from '../config/api';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from '../components/keyboard';
import {
  submitReview,
  updateReview,
  getProductReviews,
  getCachedReview,
  ReviewData,
} from '../services/reviewApi';

export interface RatingReviewScreenProps {
  productId: number;
  productName: string;
  productImage?: string;
  deliveryDate?: string;
  initialRating?: number;
  existingReview?: ReviewData | null;
  onBack: () => void;
  onReviewSubmitted?: (review: ReviewData) => void;
}

const RATING_LABELS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Great'];

const AnimatedStarItem: React.FC<{
  starIndex: number;
  isSelected: boolean;
  color: string;
  onPress: (idx: number) => void;
}> = ({ starIndex, isSelected, color, onPress }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.35,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
    onPress(starIndex);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rate ${starIndex} of 5 stars`}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={styles.starPressable}
      onPress={handlePress}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Icon
          name={isSelected ? 'star-filled' : 'star'}
          size={38}
          strokeWidth={1.8}
          color={color}
        />
      </Animated.View>
    </Pressable>
  );
};

export const RatingReviewScreen: React.FC<RatingReviewScreenProps> = ({
  productId,
  productName,
  productImage,
  deliveryDate,
  initialRating = 5,
  existingReview = null,
  onBack,
  onReviewSubmitted,
}) => {
  const theme = useAppTheme();
  const { token, user } = useAuth();
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const [rating, setRating] = useState<number>(initialRating > 0 ? initialRating : 5);
  const [comment, setComment] = useState<string>(existingReview?.comment || '');
  const [currentReview, setCurrentReview] = useState<ReviewData | null>(existingReview);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(!existingReview);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load existing user review if not provided
  useEffect(() => {
    let isMounted = true;
    async function loadUserReview() {
      if (existingReview) {
        setRating(existingReview.rating || initialRating || 5);
        setComment(existingReview.comment || '');
        setCurrentReview(existingReview);
        setLoadingInitial(false);
        return;
      }

      const cached = getCachedReview(productId);
      if (cached) {
        setRating(cached.rating || initialRating || 5);
        setComment(cached.comment || '');
        setCurrentReview(cached);
        setLoadingInitial(false);
      }

      try {
        if (!cached) setLoadingInitial(true);
        const data = await getProductReviews(productId, token || undefined);
        if (isMounted && data.userReview) {
          setCurrentReview(data.userReview);
          setRating(data.userReview.rating || initialRating || 5);
          setComment(data.userReview.comment || '');
        }
      } catch (err) {
        // Non-critical, user can still submit new review
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    loadUserReview();
    return () => {
      isMounted = false;
    };
  }, [productId, token, existingReview, initialRating]);

  const handleStarPress = (starIndex: number) => {
    setRating(starIndex);
    if (error) setError(null);
  };

  const [alertDialog, setAlertDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
  } | null>(null);

  const handleSubmit = async () => {
    if (!token) {
      setAlertDialog({
        visible: true,
        title: 'Sign In Required',
        message: 'Please sign in to submit a product review.',
        type: 'info',
      });
      return;
    }

    if (rating < 1 || rating > 5) {
      setError('Please select a star rating from 1 to 5.');
      return;
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length < 3) {
      setError('Please write at least 3 characters in your review comment.');
      return;
    }

    if (trimmedComment.length > 1000) {
      setError('Review comment cannot exceed 1000 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let result;
      if (currentReview?.id) {
        // Edit existing review
        result = await updateReview(
          currentReview.id,
          { rating, comment: trimmedComment },
          token
        );
      } else {
        // Submit new review
        result = await submitReview(
          productId,
          { rating, comment: trimmedComment },
          token
        );
      }

      setSuccessMessage(result.message || 'Review saved successfully!');
      setCurrentReview(result.review);

      // Invalidate queries so product review counts and reviews list update
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews(productId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.product(productId) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });

      // Notify parent callback
      onReviewSubmitted?.(result.review);

      setTimeout(() => {
        onBack();
      }, 1200);
    } catch (err: any) {
      const msg = err?.message || 'Could not save review. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const imageUri = resolveImageUrl(productImage) || FALLBACK_PRODUCT_IMAGE;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Screen Header */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.borderLight,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.headerBackBtn,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={onBack}
        >
          <Icon name="arrow-left" size={20} color={theme.colors.text} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {currentReview ? 'Edit Review' : 'Rate & Review'}
          </Text>
        </View>

        <View style={styles.headerRightSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <KeyboardAwareScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          extraScrollHeight={120}
        >
          {/* Product Info Card */}
          <View
            style={[
              styles.productCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.productImage,
                { backgroundColor: theme.colors.surfaceSubtle },
              ]}
              resizeMode="contain"
            />
            <View style={styles.productDetailsCol}>
              <Text
                style={[styles.productName, { color: theme.colors.text }]}
                numberOfLines={2}
              >
                {productName}
              </Text>
              {deliveryDate ? (
                <View style={styles.deliveryRow}>
                  <Icon name="check-circle" size={14} color={theme.colors.success} />
                  <Text
                    style={[
                      styles.deliveryText,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Delivered on {deliveryDate}
                  </Text>
                </View>
              ) : (
                <View style={styles.deliveryRow}>
                  <Icon name="check-circle" size={14} color={theme.colors.success} />
                  <Text
                    style={[
                      styles.deliveryText,
                      { color: theme.colors.success },
                    ]}
                  >
                    Delivered Product
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Rating Section Card */}
          <View
            style={[
              styles.ratingCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
              How would you rate this product?
            </Text>
            <Text
              style={[
                styles.sectionSubheading,
                { color: theme.colors.textMuted },
              ]}
            >
              Select your rating from 1 to 5 stars
            </Text>

            {/* Interactive Stars Row */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((starIndex) => {
                const isSelected = starIndex <= rating;
                return (
                  <AnimatedStarItem
                    key={`star-${starIndex}`}
                    starIndex={starIndex}
                    isSelected={isSelected}
                    color={isSelected ? '#F59E0B' : theme.colors.textMuted}
                    onPress={handleStarPress}
                  />
                );
              })}
            </View>

            {/* Rating Label (Terrible, Bad, Okay, Good, Great) */}
            {rating > 0 && rating <= 5 ? (
              <View
                style={[
                  styles.ratingLabelBadge,
                  { backgroundColor: theme.colors.surfaceSubtle },
                ]}
              >
                <Text
                  style={[
                    styles.ratingLabelText,
                    {
                      color:
                        rating >= 4
                          ? theme.colors.success
                          : rating === 3
                          ? '#F59E0B'
                          : theme.colors.danger,
                    },
                  ]}
                >
                  {RATING_LABELS[rating]}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Review Text Card */}
          <View
            style={[
              styles.commentCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
              Write your review
            </Text>
            <Text
              style={[
                styles.sectionSubheading,
                { color: theme.colors.textMuted },
              ]}
            >
              Share your honest feedback to help other shoppers
            </Text>

            <TextInput
              style={[
                styles.commentInput,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  color: theme.colors.text,
                  borderColor: theme.colors.borderLight,
                },
              ]}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholder="What did you like or dislike? How was the quality, fit, and overall value?"
              placeholderTextColor={theme.colors.textMuted}
              value={comment}
              onChangeText={(text) => {
                setComment(text);
                if (error) setError(null);
              }}
              onFocus={() => scrollRef.current?.scrollToInput(220)}
              maxLength={1000}
              editable={!submitting}
            />

            <View style={styles.charCountRow}>
              <Text
                style={[styles.charCountText, { color: theme.colors.textMuted }]}
              >
                {comment.length} / 1000 characters (min. 3)
              </Text>
            </View>
          </View>

          {/* Error Banner */}
          {error && (
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: theme.colors.dangerBg,
                  borderColor: theme.colors.danger,
                },
              ]}
            >
              <Icon name="alert-triangle" size={18} color={theme.colors.danger} />
              <Text
                style={[
                  styles.statusBannerText,
                  { color: theme.colors.danger },
                ]}
              >
                {error}
              </Text>
            </View>
          )}

          {/* Success Banner */}
          {successMessage && (
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: theme.colors.successBg,
                  borderColor: theme.colors.success,
                },
              ]}
            >
              <Icon name="check-circle" size={18} color={theme.colors.success} />
              <Text
                style={[
                  styles.statusBannerText,
                  { color: theme.colors.success },
                ]}
              >
                {successMessage}
              </Text>
            </View>
          )}

          {/* Submit Action Button */}
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={currentReview ? 'Update review' : 'Submit review'}
            disabled={submitting}
            style={[
              styles.submitButton,
              {
                backgroundColor: theme.colors.primary,
                opacity: submitting ? 0.7 : 1,
              },
            ]}
            activeScale={0.96}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator
                color={theme.colors.primaryText}
                size="small"
              />
            ) : (
              <Text
                style={[
                  styles.submitButtonText,
                  { color: theme.colors.primaryText },
                ]}
              >
                {currentReview ? 'Update Review' : 'Submit Review'}
              </Text>
            )}
          </ScalePressable>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>

      <AlertDialog
        visible={alertDialog?.visible || false}
        title={alertDialog?.title || ''}
        message={alertDialog?.message || ''}
        type={alertDialog?.type || 'info'}
        onClose={() => setAlertDialog(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerRightSpacer: {
    width: 38,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  productCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  productDetailsCol: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 20,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliveryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  ratingCard: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  sectionSubheading: {
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  starPressable: {
    padding: 4,
  },
  ratingLabelBadge: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 4,
  },
  ratingLabelText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  commentCard: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  commentInput: {
    minHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  charCountText: {
    fontSize: 12,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  submitButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
