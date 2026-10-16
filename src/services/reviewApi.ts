import { fetchWithFallback } from './api';

export interface ReviewData {
  id: number;
  userId: number;
  userName: string;
  productId: number;
  rating: number;
  comment: string;
  isVerifiedBuyer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReviewsResponse {
  reviews: ReviewData[];
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: Record<number, number>;
  isEligibleToReview: boolean;
  userReview: ReviewData | null;
}

export interface SubmitReviewPayload {
  rating: number;
  comment: string;
}

export interface ReviewSubmitResponse {
  success: boolean;
  message: string;
  review: ReviewData;
}

// In-memory review cache to persist customer ratings across screen navigation
const reviewsCache: Record<number, ReviewData> = {};

export function setCachedReview(review: ReviewData): void {
  if (review && review.productId) {
    reviewsCache[review.productId] = review;
  }
}

export function getCachedReview(productId: number): ReviewData | undefined {
  return reviewsCache[productId];
}

export function getAllCachedReviews(): Record<number, ReviewData> {
  return { ...reviewsCache };
}

/**
 * Fetch all reviews, rating breakdown, and eligibility/userReview for a product.
 */
export async function getProductReviews(
  productId: number,
  token?: string
): Promise<ProductReviewsResponse> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token && token.trim()) {
    headers.Cookie = `token=${token.trim()}`;
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const endpoint = `/api/products/${productId}/reviews`;
  const response = await fetchWithFallback(endpoint, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to load reviews (HTTP ${response.status})`);
  }

  const data = await response.json();
  const stats = data?.stats || {};
  const userReview: ReviewData | null = stats?.userReview || data?.userReview || null;

  if (userReview) {
    setCachedReview(userReview);
  }

  const totalReviews =
    typeof stats?.totalReviews === 'number'
      ? stats.totalReviews
      : typeof data?.totalReviews === 'number'
      ? data.totalReviews
      : 0;

  const averageRating =
    typeof stats?.averageRating === 'number'
      ? stats.averageRating
      : typeof data?.averageRating === 'number'
      ? data.averageRating
      : 0;

  const ratingBreakdown =
    stats?.ratingBreakdown || data?.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const isEligibleToReview = Boolean(stats?.isEligibleToReview ?? data?.isEligibleToReview);

  return {
    reviews: Array.isArray(data?.reviews) ? data.reviews : [],
    totalReviews,
    averageRating,
    ratingBreakdown,
    isEligibleToReview,
    userReview,
  };
}

/**
 * Submit a new product review (POST /api/products/[id]/reviews).
 */
export async function submitReview(
  productId: number,
  payload: SubmitReviewPayload,
  token: string
): Promise<ReviewSubmitResponse> {
  if (!token || !token.trim()) {
    throw new Error('Authentication required. Please sign in to submit a review.');
  }

  const endpoint = `/api/products/${productId}/reviews`;
  const response = await fetchWithFallback(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: `token=${token.trim()}`,
      Authorization: `Bearer ${token.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText || 'Invalid server response' };
  }

  if (!response.ok) {
    throw new Error(data?.message || `Failed to submit review (HTTP ${response.status})`);
  }

  if (data?.review) {
    setCachedReview(data.review);
  }

  return {
    success: true,
    message: data?.message || 'Review submitted successfully.',
    review: data?.review,
  };
}

/**
 * Update an existing review (PUT /api/reviews/[id]).
 */
export async function updateReview(
  reviewId: number,
  payload: SubmitReviewPayload,
  token: string
): Promise<ReviewSubmitResponse> {
  if (!token || !token.trim()) {
    throw new Error('Authentication required. Please sign in to edit your review.');
  }

  const endpoint = `/api/reviews/${reviewId}`;
  const response = await fetchWithFallback(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: `token=${token.trim()}`,
      Authorization: `Bearer ${token.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText || 'Invalid server response' };
  }

  if (!response.ok) {
    throw new Error(data?.message || `Failed to update review (HTTP ${response.status})`);
  }

  if (data?.review) {
    setCachedReview(data.review);
  }

  return {
    success: true,
    message: data?.message || 'Review updated successfully.',
    review: data?.review,
  };
}
