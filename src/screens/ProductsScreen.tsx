import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Dimensions,
  StatusBar,
  Modal,
  Keyboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryKeys';
import { queryClient as staticQueryClient } from '../config/queryClient';
import { getProducts, getAllProducts, getCategories } from '../services/api';
import type { Product } from '../types/product';
import { ProductCard } from '../components/ProductCard';
import { CategoryItem } from '../components/CategoryItem';
import { useWishlist } from '../context/WishlistContext';
import { Icon } from '../components/Icon';
import { FullScreenRefreshLoader, FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 12;
const GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GAP) / 2;

export interface ProductsScreenProps {
  isActive?: boolean;
  initialCategory?: string;
  initialSearch?: string;
  autoFocusSearch?: boolean;
  searchFocusKey?: number;
  onConsumeAutoFocus?: () => void;
  onBack?: () => void;
  onProductPress?: (productId: number) => void;
  onCartPress?: () => void;
  onWishlistPress?: () => void;
  onAddToCart?: (product: Product) => void;
  onAccountPress?: () => void;
  cartItemCount?: number;
  isLoggedIn?: boolean;
  userName?: string;
}

export type SortOption =
  | 'default'
  | 'price-low'
  | 'price-high'
  | 'name-az'
  | 'discount';

interface SortItemConfig {
  key: SortOption;
  label: string;
}

const SORT_OPTIONS: SortItemConfig[] = [
  { key: 'default', label: 'Recommended' },
  { key: 'price-low', label: 'Price: Low to High' },
  { key: 'price-high', label: 'Price: High to Low' },
  { key: 'name-az', label: 'Name: A to Z' },
  { key: 'discount', label: 'Highest Discount' },
];

export interface ProductsScreenSavedState {
  category: string;
  search: string;
  sort: SortOption;
  scrollOffset: number;
  loadedProducts?: Product[];
  totalCount?: number;
  page?: number;
  hasMore?: boolean;
}

let lastProductsScreenState: ProductsScreenSavedState | null = null;

export function getLastProductsScreenState(): ProductsScreenSavedState | null {
  return lastProductsScreenState;
}

export function setLastProductsScreenState(state: ProductsScreenSavedState | null): void {
  lastProductsScreenState = state;
}

export function clearProductsScreenState(): void {
  lastProductsScreenState = null;
}

export const ProductsScreen: React.FC<ProductsScreenProps> = ({
  isActive = true,
  initialCategory = 'All',
  initialSearch = '',
  autoFocusSearch = false,
  searchFocusKey,
  onConsumeAutoFocus,
  onBack,
  onProductPress,
  onCartPress,
  onWishlistPress,
  onAddToCart,
  onAccountPress,
  cartItemCount = 0,
  isLoggedIn = false,
  userName,
}) => {
  const theme = useAppTheme();
  const { wishlistCount } = useWishlist();

  let queryClient = staticQueryClient;
  try {
    const activeClient = useQueryClient();
    if (activeClient) queryClient = activeClient;
  } catch {
    // Fallback to staticQueryClient in isolated environments
  }

  // Synchronously restore previous session/navigation state if returning or remounting
  const savedState = getLastProductsScreenState();
  const isMatchingCategory =
    !initialCategory ||
    initialCategory.toLowerCase() === 'all' ||
    (savedState?.category && savedState.category.toLowerCase() === initialCategory.toLowerCase());

  const initCategory =
    isMatchingCategory && savedState?.category
      ? savedState.category
      : initialCategory || 'All';
  const initSearch =
    isMatchingCategory && savedState?.search !== undefined
      ? savedState.search
      : initialSearch || '';
  const initSort = isMatchingCategory && savedState?.sort ? savedState.sort : 'default';
  const initialScrollTarget = isMatchingCategory ? savedState?.scrollOffset || 0 : 0;

  const normInitCategory =
    (initCategory || 'All').toLowerCase() === 'all' ? 'all' : initCategory || 'All';
  const initialCacheKey = queryKeys.products(
    normInitCategory,
    initSearch || '',
    initSort,
    1
  );
  const initialCached = queryClient.getQueryData<any>(initialCacheKey);

  // Filter states
  const [searchQuery, setSearchQuery] = useState(initSearch);
  const [submittedQuery, setSubmittedQuery] = useState(initSearch);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(initCategory);
  const [selectedSort, setSelectedSort] = useState<SortOption>(initSort);
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Data states - synchronously initialized from queryClient cache if available
  const [products, setProducts] = useState<Product[]>(() => initialCached?.products || []);
  const [categories, setCategories] = useState<string[]>(() => {
    const cachedCats = queryClient.getQueryData<string[]>(queryKeys.categories);
    return cachedCats && cachedCats.length > 0 ? cachedCats : ['All'];
  });
  const [totalProducts, setTotalProducts] = useState<number>(
    () => initialCached?.total || initialCached?.products?.length || 0
  );

  // Pagination states
  const [page, setPage] = useState<number>(() => initialCached?.page || 1);
  const [hasMore, setHasMore] = useState<boolean>(() => initialCached?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Status states - loading is false if cached data exists, preventing full-screen loader flash!
  const [loading, setLoading] = useState<boolean>(() => !initialCached?.products?.length);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(() => !!initialCached?.products?.length);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFetchId = useRef(0);
  const isFetchingMoreRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const categoryListRef = useRef<FlatList>(null);
  const searchInputRef = useRef<any>(null);
  const hasPositionedInitialCatRef = useRef(false);
  const hasLoadedOnceRef = useRef(!!initialCached?.products?.length);
  const isNavigatingAwayRef = useRef(false);
  const isRestoringScrollRef = useRef(false);

  // Scroll offset preservation and restoration
  const currentScrollOffsetRef = useRef<number>(initialScrollTarget);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Ignore scroll events when screen is inactive/hidden or navigating away
      if (isActive === false || isNavigatingAwayRef.current) return;
      const y = event.nativeEvent.contentOffset.y;
      // Guard against spurious y near 0 reset events during layout transitions if previously scrolled
      if (y <= 5 && currentScrollOffsetRef.current > 50) {
        return;
      }
      isRestoringScrollRef.current = false;
      currentScrollOffsetRef.current = y;
      lastProductsScreenState = {
        category: selectedCategory,
        search: submittedQuery,
        sort: selectedSort,
        scrollOffset: y,
      };
    },
    [isActive, selectedCategory, submittedQuery, selectedSort]
  );

  const restoreScrollPosition = useCallback(() => {
    const target = currentScrollOffsetRef.current || lastProductsScreenState?.scrollOffset || 0;
    if (target > 0 && flatListRef.current) {
      try {
        flatListRef.current.scrollToOffset({ offset: target, animated: false });
      } catch {
        // Layout might not be ready yet
      }
    }
  }, []);

  // When screen becomes active again upon Back navigation, restore scroll position
  const prevIsActiveRef = useRef(isActive);
  useEffect(() => {
    if (prevIsActiveRef.current === false && isActive === true) {
      isNavigatingAwayRef.current = false;
      isRestoringScrollRef.current = true;
      const target = currentScrollOffsetRef.current || lastProductsScreenState?.scrollOffset || 0;
      if (target > 0 && flatListRef.current) {
        restoreScrollPosition();
        const frameId = requestAnimationFrame(() => {
          restoreScrollPosition();
        });
        const timer1 = setTimeout(() => {
          restoreScrollPosition();
        }, 50);
        const timer2 = setTimeout(() => {
          restoreScrollPosition();
          isRestoringScrollRef.current = false;
        }, 180);
        return () => {
          cancelAnimationFrame(frameId);
          clearTimeout(timer1);
          clearTimeout(timer2);
          isRestoringScrollRef.current = false;
        };
      } else {
        isRestoringScrollRef.current = false;
      }
    }
    prevIsActiveRef.current = isActive;
  }, [isActive, restoreScrollPosition]);

  // Reliable search input focus helper with retries for Android soft keyboard
  const focusSearchInput = useCallback(() => {
    // Focus immediately if reference is mounted
    searchInputRef.current?.focus();

    // Next animation frame
    const frameId = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    // Staggered timers to ensure native layout/window attachment on Android
    const timer1 = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 120);

    const timer2 = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 280);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Track the last consumed focus trigger key to prevent repeated keyboard openings
  const lastHandledFocusKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (autoFocusSearch) {
      const currentKey = searchFocusKey ?? 1;
      if (lastHandledFocusKeyRef.current !== currentKey) {
        lastHandledFocusKeyRef.current = currentKey;
        const cleanup = focusSearchInput();
        if (onConsumeAutoFocus) {
          onConsumeAutoFocus();
        }
        return cleanup;
      }
    }
  }, [autoFocusSearch, searchFocusKey, focusSearchInput, onConsumeAutoFocus]);

  const activeSuggestionFetchId = useRef(0);

  // Determine whether search suggestion overlay should be active
  const isShowingSuggestions =
    searchQuery.trim().length > 0 &&
    searchQuery.trim().toLowerCase() !== submittedQuery.trim().toLowerCase();

  // Fetch search suggestions (matching product names only) as user types
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.toLowerCase() === submittedQuery.trim().toLowerCase()) {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }

    setIsFetchingSuggestions(true);
    const fetchId = ++activeSuggestionFetchId.current;

    const timer = setTimeout(async () => {
      try {
        const response = await getProducts({
          page: 1,
          limit: 12,
          category: 'all',
          search: trimmed,
        });

        if (fetchId !== activeSuggestionFetchId.current) {
          return;
        }

        const queryLower = trimmed.toLowerCase();
        const seen = new Set<string>();
        const matchingNames: string[] = [];

        // 1. Extract product names from search response
        (response.products || []).forEach((p) => {
          const name = p.name?.trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            matchingNames.push(name);
          }
        });

        // 2. Also incorporate any matches from already loaded products pool
        products.forEach((p) => {
          const name = p.name?.trim();
          if (
            name &&
            !seen.has(name.toLowerCase()) &&
            name.toLowerCase().includes(queryLower)
          ) {
            seen.add(name.toLowerCase());
            matchingNames.push(name);
          }
        });

        setSuggestions(matchingNames);
      } catch (err) {
        if (fetchId !== activeSuggestionFetchId.current) return;
        // Fallback to local filtering if network is temporarily unreachable
        const queryLower = trimmed.toLowerCase();
        const seen = new Set<string>();
        const localMatches = products
          .filter((p) => p.name?.toLowerCase().includes(queryLower))
          .map((p) => p.name.trim())
          .filter((name) => {
            if (seen.has(name.toLowerCase())) return false;
            seen.add(name.toLowerCase());
            return true;
          });
        setSuggestions(localMatches);
      } finally {
        if (fetchId === activeSuggestionFetchId.current) {
          setIsFetchingSuggestions(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, submittedQuery, products]);

  // Load Categories on mount with TanStack Query cache
  useEffect(() => {
    let isMounted = true;
    const cachedCats = queryClient.getQueryData<string[]>(queryKeys.categories);
    if (cachedCats && cachedCats.length > 0) {
      setCategories(cachedCats);
    }
    getCategories()
      .then((catList) => {
        if (!isMounted) return;
        if (catList && catList.length > 0) {
          const sanitized = ['All', ...catList.filter((c) => c !== 'All')];
          setCategories(sanitized);
          queryClient.setQueryData(queryKeys.categories, sanitized);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch categories:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Track previous prop values to avoid overriding user's in-screen selections on back navigation
  const prevInitialCatPropRef = useRef(initialCategory);
  const prevInitialSearchPropRef = useRef(initialSearch);

  useEffect(() => {
    if (prevInitialCatPropRef.current !== initialCategory) {
      prevInitialCatPropRef.current = initialCategory;
      if (initialCategory && initialCategory !== selectedCategory) {
        setSelectedCategory(initialCategory);
      }
    }
    if (prevInitialSearchPropRef.current !== initialSearch) {
      prevInitialSearchPropRef.current = initialSearch;
      if (initialSearch !== undefined && initialSearch !== searchQuery) {
        setSearchQuery(initialSearch);
        setSubmittedQuery(initialSearch);
      }
    }
    setSuggestions([]);
  }, [initialCategory, initialSearch, selectedCategory, searchQuery]);

  // Ensure initial non-'All' category chip is positioned into view once on initial load
  useEffect(() => {
    if (
      initialCategory &&
      initialCategory !== 'All' &&
      !hasPositionedInitialCatRef.current &&
      categories.length > 1
    ) {
      const targetIndex = categories.findIndex((c) => c === initialCategory);
      if (targetIndex > 0) {
        hasPositionedInitialCatRef.current = true;
        setTimeout(() => {
          try {
            categoryListRef.current?.scrollToIndex({
              index: targetIndex,
              animated: false,
              viewPosition: 0.3,
            });
          } catch {
            // Layout might not be measured yet
          }
        }, 120);
      }
    }
  }, [initialCategory, categories]);

  const PRODUCTS_PER_PAGE = 8;

  // Fetch initial batch (Page 1) of products based on current filters and sort
  const fetchProducts = useCallback(
    async (
      category: string,
      search: string,
      sort: SortOption,
      isRefresh = false
    ) => {
      const fetchId = ++activeFetchId.current;
      isFetchingMoreRef.current = false;

      const normCategory = category.toLowerCase() === 'all' ? 'all' : category;
      const normSearch = search.trim();
      const cacheKey = queryKeys.products(normCategory, normSearch, sort, 1);
      let cached = queryClient.getQueryData<any>(cacheKey);

      // If query client has no cached data yet, check if preserved screen state has loaded products for matching filters
      if (!cached?.products?.length) {
        const lastState = getLastProductsScreenState();
        if (
          lastState?.loadedProducts?.length &&
          (lastState.category || 'all').toLowerCase() === normCategory &&
          (lastState.search || '').trim() === normSearch &&
          (lastState.sort || 'default') === sort
        ) {
          cached = {
            products: lastState.loadedProducts,
            total: lastState.totalCount || lastState.loadedProducts.length,
            page: lastState.page || 1,
            hasMore: lastState.hasMore ?? false,
          };
          queryClient.setQueryData(cacheKey, cached);
        }
      }

      // Check cache freshness based on staleTime (60 seconds)
      const queryState = queryClient.getQueryState(cacheKey);
      const isFresh = queryState
        ? Date.now() - queryState.dataUpdatedAt < 60 * 1000
        : !!cached?.products?.length;

      if (cached?.products?.length && !isRefresh) {
        setProducts(cached.products);
        setTotalProducts(cached.total || cached.products.length);
        setPage(cached.page || 1);
        setHasMore(cached.hasMore ?? false);
        setHasLoadedOnce(true);
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setIsSearching(false);

        // When multi-page infinite scroll data is loaded (page > 1) or user is scrolled into the list on back navigation,
        // preserve the list and return early to prevent resetting scroll position and duplicate requests
        if ((cached.page && cached.page > 1) || (currentScrollOffsetRef.current > 0 && !isRefresh)) {
          return;
        }
      } else if (!isRefresh) {
        if (!hasLoadedOnceRef.current && productsCountRef.current === 0) {
          setLoading(true);
        } else {
          setIsSearching(true);
        }
      }
      setError(null);

      try {
        const loadTask = async () => {
          return await getProducts({
            page: 1,
            limit: PRODUCTS_PER_PAGE,
            category: category === 'All' ? 'all' : category,
            search: search.trim(),
            sort: sort,
          });
        };

        const response = await loadTask();

        if (fetchId !== activeFetchId.current) {
          return;
        }

        const initialBatch = response?.products || [];
        // Deduplicate by product id
        const seen = new Set<number>();
        const uniqueProducts: Product[] = [];
        for (const prod of initialBatch) {
          if (prod && typeof prod.id === 'number') {
            if (!seen.has(prod.id)) {
              seen.add(prod.id);
              uniqueProducts.push(prod);
            }
          } else if (prod) {
            uniqueProducts.push(prod);
          }
        }

        setProducts(uniqueProducts);
        setPage(1);
        const moreAvailable =
          typeof response?.hasMore === 'boolean'
            ? response.hasMore
            : (response?.page ?? 1) < (response?.totalPages ?? 1);
        setHasMore(moreAvailable);
        const total =
          typeof response?.total === 'number' && response.total > 0
            ? response.total
            : uniqueProducts.length;
        setTotalProducts(total);

        // Update queryClient cache
        queryClient.setQueryData(cacheKey, {
          products: uniqueProducts,
          total,
          hasMore: moreAvailable,
          page: 1,
        });

        if (response?.categories && response.categories.length > 0) {
          const sanitizedCats = ['All', ...response.categories.filter((c: string) => c !== 'All')];
          setCategories((prev) => {
            if (prev.length <= 1 || isRefresh) {
              return sanitizedCats;
            }
            return prev;
          });
          queryClient.setQueryData(queryKeys.categories, sanitizedCats);
        }
        setHasLoadedOnce(true);
        hasLoadedOnceRef.current = true;
      } catch (err: any) {
        if (fetchId !== activeFetchId.current) return;
        const isAbort =
          err?.name === 'AbortError' ||
          err?.message === 'Aborted' ||
          String(err).includes('AbortError');
        const isTimeout = err?.name === 'TimeoutError' || isAbort;

        console.error('Failed to load products in ProductsScreen:', err);
        // If refreshing or existing products are present, keep them visible
        if (!isRefresh || productsCountRef.current === 0) {
          setError(
            isTimeout
              ? 'Unable to connect to server. Please ensure the backend server is running and check your network connection.'
              : err?.message ||
              'Unable to load products. Please check your network connection and retry.'
          );
        }
      } finally {
        if (fetchId === activeFetchId.current) {
          setLoading(false);
          setIsSearching(false);
          setRefreshing(false);
        }
      }
    },
    [queryClient]
  );

  // Automatically fetch next batch when user scrolls near the bottom
  const loadMoreProducts = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore || isFetchingMoreRef.current) {
      return;
    }

    isFetchingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    const currentFetchId = activeFetchId.current;
    const normCategory = selectedCategory.toLowerCase() === 'all' ? 'all' : selectedCategory;
    const normSearch = submittedQuery.trim();
    const cacheKey = queryKeys.products(normCategory, normSearch, selectedSort, 1);

    try {
      const response = await getProducts({
        page: nextPage,
        limit: PRODUCTS_PER_PAGE,
        category: normCategory,
        search: normSearch,
        sort: selectedSort,
      });

      if (currentFetchId !== activeFetchId.current) {
        return;
      }

      const nextBatch = response?.products || [];
      if (nextBatch.length > 0) {
        const moreAvailable =
          typeof response?.hasMore === 'boolean'
            ? response.hasMore
            : (response?.page ?? nextPage) < (response?.totalPages ?? 1);
        const total =
          typeof response?.total === 'number' && response.total > 0
            ? response.total
            : undefined;

        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newItems = nextBatch.filter((p) => !existingIds.has(p.id));
          const updated = [...prev, ...newItems];

          // Store accumulated products in queryClient cache so navigating away preserves all loaded pages!
          queryClient.setQueryData(cacheKey, {
            products: updated,
            total: total || updated.length,
            hasMore: moreAvailable && newItems.length > 0,
            page: nextPage,
          });

          return updated;
        });
        setPage(nextPage);
        setHasMore(moreAvailable && nextBatch.length > 0);
        if (total) {
          setTotalProducts(total);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Failed to load more products:', err);
    } finally {
      if (currentFetchId === activeFetchId.current) {
        setLoadingMore(false);
        isFetchingMoreRef.current = false;
      }
    }
  }, [
    loading,
    refreshing,
    loadingMore,
    hasMore,
    page,
    selectedCategory,
    submittedQuery,
    selectedSort,
    queryClient,
  ]);

  const productsCountRef = useRef(0);
  productsCountRef.current = products.length;

  // Trigger fetch when filters or sort changes
  useEffect(() => {
    fetchProducts(selectedCategory, submittedQuery, selectedSort);
  }, [selectedCategory, submittedQuery, selectedSort, fetchProducts]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    getCategories()
      .then((catList) => {
        if (catList && catList.length > 0) {
          setCategories(['All', ...catList.filter((c) => c !== 'All')]);
        }
      })
      .catch(() => { });

    fetchProducts(selectedCategory, submittedQuery, selectedSort, true);
  }, [refreshing, selectedCategory, submittedQuery, selectedSort, fetchProducts]);

  // Search input change handler - updates immediate text without lag
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
    }
  }, []);

  // Submit search query (keyboard Enter/Search or suggestion tap)
  const submitSearch = useCallback(
    (queryToSubmit: string) => {
      Keyboard.dismiss();
      const sanitized = queryToSubmit.trim();
      setSearchQuery(sanitized);
      setSuggestions([]);
      setIsFetchingSuggestions(false);

      if (sanitized.toLowerCase() !== submittedQuery.trim().toLowerCase()) {
        setSubmittedQuery(sanitized);
      } else if (sanitized.length > 0) {
        // Re-execute search fresh without duplicate call issues
        fetchProducts(selectedCategory, sanitized, selectedSort);
      }
      currentScrollOffsetRef.current = 0;
      if (lastProductsScreenState) {
        lastProductsScreenState.scrollOffset = 0;
        lastProductsScreenState.search = sanitized;
      }
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [submittedQuery, selectedCategory, selectedSort, fetchProducts]
  );

  // Search submit handler (keyboard Enter/Search)
  const handleSearchSubmit = useCallback(() => {
    submitSearch(searchQuery);
  }, [submitSearch, searchQuery]);

  // Suggestion tap handler
  const handleSelectSuggestion = useCallback(
    (name: string) => {
      submitSearch(name);
    },
    [submitSearch]
  );

  // Category select handler - updates category
  const handleSelectCategory = useCallback((cat: string) => {
    if (cat === selectedCategory) return;
    currentScrollOffsetRef.current = 0;
    if (lastProductsScreenState) {
      lastProductsScreenState.category = cat;
      lastProductsScreenState.scrollOffset = 0;
    }
    setSelectedCategory(cat);
  }, [selectedCategory]);

  // Key extractor for category chips
  const categoryKeyExtractor = useCallback(
    (item: string) => `cat-filter-${item}`,
    []
  );

  // Memoized renderItem for category chips
  const renderCategoryItem = useCallback(
    ({ item }: { item: string }) => (
      <CategoryItem
        name={item}
        isSelected={selectedCategory === item}
        onSelect={handleSelectCategory}
      />
    ),
    [selectedCategory, handleSelectCategory]
  );

  // Sort select handler
  const handleSelectSort = (sort: SortOption) => {
    setSelectedSort(sort);
    setIsSortModalVisible(false);
    currentScrollOffsetRef.current = 0;
    if (lastProductsScreenState) {
      lastProductsScreenState.sort = sort;
      lastProductsScreenState.scrollOffset = 0;
    }
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Clear search input
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSubmittedQuery('');
    setSuggestions([]);
    setIsFetchingSuggestions(false);
  }, []);

  // Clear all filters handler (explicit user reset)
  const handleClearAllFilters = useCallback(() => {
    setSearchQuery('');
    setSubmittedQuery('');
    setSuggestions([]);
    setIsFetchingSuggestions(false);
    setSelectedCategory('All');
    setSelectedSort('default');
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    categoryListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.key === selectedSort)?.label || 'Recommended';

  // Header of FlatList: Sort & Filter Controls (Memoized, independent of typing)
  const renderListHeader = useCallback(() => {
    const hasActiveFilters =
      submittedQuery.trim().length > 0 ||
      selectedCategory !== 'All' ||
      selectedSort !== 'default';

    return (
      <View style={styles.listHeaderContainer}>
        {/* Sort Selector Bar */}
        <View style={styles.filterSummaryBar}>
          <View style={{ flex: 1 }} />
          {/* Sort Selector Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort by: ${currentSortLabel}`}
            style={({ pressed }) => [
              styles.sortButton,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => setIsSortModalVisible(true)}
          >
            <Icon
              name="arrow-up-down"
              size={13}
              color={theme.colors.text}
              strokeWidth={2.3}
            />
            <Text
              style={[
                styles.sortButtonText,
                { color: theme.colors.text, marginLeft: 6 },
              ]}
            >
              {currentSortLabel}
            </Text>
          </Pressable>
        </View>

        {/* Active Filter Pill with Clear option */}
        {hasActiveFilters && (
          <View style={styles.activeFiltersRow}>
            <Text style={[styles.activeFiltersLabel, { color: theme.colors.textMuted }]}>
              Active Filters:
            </Text>
            {selectedCategory !== 'All' && (
              <View
                style={[
                  styles.filterTag,
                  { backgroundColor: theme.colors.surfaceSubtle },
                ]}
              >
                <Text style={[styles.filterTagText, { color: theme.colors.text }]}>
                  {selectedCategory}
                </Text>
                <Pressable onPress={() => handleSelectCategory('All')}>
                  <Icon name="close" size={12} color={theme.colors.textMuted} strokeWidth={2.5} />
                </Pressable>
              </View>
            )}
            {submittedQuery.trim().length > 0 && (
              <View
                style={[
                  styles.filterTag,
                  { backgroundColor: theme.colors.surfaceSubtle },
                ]}
              >
                <Text style={[styles.filterTagText, { color: theme.colors.text }]}>
                  "{submittedQuery.trim()}"
                </Text>
                <Pressable onPress={handleClearSearch}>
                  <Icon name="close" size={12} color={theme.colors.textMuted} strokeWidth={2.5} />
                </Pressable>
              </View>
            )}
            <Pressable onPress={handleClearAllFilters} style={styles.clearAllFiltersBtn}>
              <Text style={[styles.clearAllFiltersText, { color: theme.colors.danger }]}>
                Reset
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }, [
    selectedCategory,
    selectedSort,
    submittedQuery,
    currentSortLabel,
    theme.colors,
    handleSelectCategory,
    handleClearSearch,
    handleClearAllFilters,
  ]);

  // Footer Component: Loading More Indicator & End of List Indicator
  const renderListFooter = () => {
    if (loading && !hasLoadedOnce) {
      return null;
    }

    if (products.length === 0) {
      return null;
    }

    if (loadingMore) {
      return (
        <View style={styles.listFooterContainer}>
          <View style={styles.loadingMoreSpinnerRow}>
            <ActivityIndicator size="small" color={theme.colors.brandBlue || theme.colors.primary} />
            <Text style={[styles.loadingMoreText, { color: theme.colors.textSecondary }]}>
              Loading more products...
            </Text>
          </View>
          <View style={styles.bottomSpacer} />
        </View>
      );
    }

    if (!hasMore && products.length > 0) {
      return (
        <View style={styles.listFooterContainer}>
          {/* End of List: Subtle message showing all products are loaded */}
          <View style={styles.endOfListRow}>
            <View
              style={[
                styles.endOfListDivider,
                { backgroundColor: theme.colors.borderLight },
              ]}
            />
            <View
              style={[
                styles.endOfListBadge,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.borderLight,
                },
              ]}
            >
              <Icon
                name="check"
                size={12}
                color={theme.colors.textMuted}
                strokeWidth={2.4}
              />
              <Text
                style={[
                  styles.endOfListText,
                  { color: theme.colors.textMuted },
                ]}
              >
                All {products.length} products loaded
              </Text>
            </View>
            <View
              style={[
                styles.endOfListDivider,
                { backgroundColor: theme.colors.borderLight },
              ]}
            />
          </View>

          <View style={styles.bottomSpacer} />
        </View>
      );
    }

    return <View style={styles.bottomSpacer} />;
  };

  // Empty State when no products match filters
  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View
        style={[
          styles.emptyContainer,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.borderLight },
        ]}
      >
        <View style={{ marginBottom: 12 }}>
          <Icon name="search" size={44} color={theme.colors.textMuted} strokeWidth={1.8} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
          No products found
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
          {submittedQuery.trim().length > 0
            ? `No matching products found for "${submittedQuery.trim()}". Try checking your spelling or clear your search.`
            : `No products available in "${selectedCategory}".`}
        </Text>
        <Pressable
          style={[styles.resetFilterBtn, { backgroundColor: theme.colors.primary }]}
          onPress={handleClearAllFilters}
        >
          <Text
            style={[
              styles.resetFilterText,
              { color: theme.colors.primaryText },
            ]}
          >
            Clear All Filters
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderProductItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard
        product={item}
        cardWidth={CARD_WIDTH}
        onPress={(p) => {
          isNavigatingAwayRef.current = true;
          lastProductsScreenState = {
            category: selectedCategory,
            search: submittedQuery,
            sort: selectedSort,
            scrollOffset: currentScrollOffsetRef.current,
            loadedProducts: products,
            page,
            hasMore,
            totalCount: totalProducts,
          };
          onProductPress?.(p.id);
        }}
        onAddToCart={onAddToCart}
      />
    ),
    [selectedCategory, submittedQuery, selectedSort, currentScrollOffsetRef, products, page, hasMore, totalProducts, onProductPress, onAddToCart]
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.borderLight,
          },
        ]}
      >
        <View style={styles.headerTitleGroup}>
          {onBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [
                styles.backButton,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={onBack}
            >
              <Icon name="arrow-left" size={18} color={theme.colors.text} strokeWidth={2.2} />
            </Pressable>
          )}
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            All Products
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View wishlist"
            style={({ pressed }) => [
              styles.headerActionBtn,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={onWishlistPress}
          >
            <Icon
              name={wishlistCount > 0 ? 'heart-filled' : 'heart'}
              size={19}
              color={
                wishlistCount > 0
                  ? '#EF4444'
                  : theme.isDark
                    ? '#FFFFFF'
                    : theme.colors.text
              }
              strokeWidth={2.2}
            />
            {wishlistCount > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.accent },
                ]}
              >
                <Text style={styles.badgeText}>
                  {wishlistCount > 99 ? '99+' : wishlistCount}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View shopping cart"
            style={({ pressed }) => [
              styles.headerActionBtn,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={onCartPress}
          >
            <Icon name="cart" size={19} color={theme.colors.text} strokeWidth={2.2} />
            {cartItemCount > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.danger },
                ]}
              >
                <Text style={styles.badgeText}>
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Permanently Mounted Search Bar - Never unmounts, responsive typing */}
      <View
        style={[
          styles.searchBarWrapper,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.borderLight,
          },
        ]}
      >
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor: isSearchFocused ? theme.colors.brandBlue : theme.colors.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Focus search input"
            onPress={focusSearchInput}
            style={styles.searchIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="search" size={17} color={theme.colors.textMuted} strokeWidth={2.2} />
          </Pressable>
          <TextInput
            ref={searchInputRef}
            autoFocus={autoFocusSearch}
            accessibilityLabel="Search products"
            placeholder="Search products by name..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            style={[styles.searchInput, { color: theme.colors.text }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
              onPress={handleClearSearch}
              style={styles.clearSearchBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close" size={14} color={theme.colors.textMuted} strokeWidth={2.5} />
            </Pressable>
          )}
          {isSearching && (
            <ActivityIndicator
              size="small"
              color={theme.colors.brandBlue}
              style={{ marginLeft: 6 }}
            />
          )}
        </View>
      </View>

      {/* Horizontally Scrollable Category Filter - Hidden when showing suggestions */}
      <View
        style={[
          styles.categoriesSection,
          { backgroundColor: theme.colors.background },
          isShowingSuggestions && { display: 'none' },
        ]}
      >
        <FlatList
          ref={categoryListRef}
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={categoryKeyExtractor}
          contentContainerStyle={styles.categoriesListContent}
          renderItem={renderCategoryItem}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              try {
                categoryListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                });
              } catch {
                // Ignore
              }
            }, 100);
          }}
        />
      </View>

      {/* Main Content Area */}
      {isShowingSuggestions ? (
        <View
          style={[
            styles.suggestionsContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {isFetchingSuggestions && suggestions.length === 0 ? (
            <View style={styles.suggestionLoadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.brandBlue} />
              <Text
                style={[
                  styles.suggestionLoadingText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Searching suggestions...
              </Text>
            </View>
          ) : suggestions.length === 0 ? (
            <View style={styles.emptySuggestionsContainer}>
              <View style={{ marginBottom: 12 }}>
                <Icon
                  name="search"
                  size={36}
                  color={theme.colors.textMuted}
                  strokeWidth={1.8}
                />
              </View>
              <Text
                style={[
                  styles.emptySuggestionsTitle,
                  { color: theme.colors.text },
                ]}
              >
                No suggestions found for "{searchQuery.trim()}"
              </Text>
              <Text
                style={[
                  styles.emptySuggestionsSubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Press Search on the keyboard to view all matching product results.
              </Text>
            </View>
          ) : (
            <FlatList
              key="suggestions-list"
              data={suggestions}
              keyExtractor={(item, index) => `suggestion-${item}-${index}`}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${item}`}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    {
                      borderBottomColor: theme.colors.borderLight,
                      backgroundColor: pressed
                        ? theme.colors.surfaceSubtle
                        : 'transparent',
                    },
                  ]}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <View
                    style={[
                      styles.suggestionIconWrap,
                      { backgroundColor: theme.colors.surfaceSubtle },
                    ]}
                  >
                    <Icon
                      name="search"
                      size={14}
                      color={theme.colors.textMuted}
                      strokeWidth={2}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.suggestionText,
                      { color: theme.colors.text },
                    ]}
                  >
                    {item}
                  </Text>
                  <Icon
                    name="chevron-right"
                    size={16}
                    color={theme.colors.textMuted}
                    strokeWidth={2}
                  />
                </Pressable>
              )}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.suggestionsListContent}
              ListHeaderComponent={
                <View style={styles.suggestionsHeader}>
                  <Text
                    style={[
                      styles.suggestionsHeaderTitle,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    Product Suggestions
                  </Text>
                  {isFetchingSuggestions && (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.brandBlue}
                    />
                  )}
                </View>
              }
            />
          )}
        </View>
      ) : loading && !hasLoadedOnce && products.length === 0 ? (
        <FullPageContentLoader message="Loading Products..." />
      ) : error && products.length === 0 ? (
        <View style={styles.centerContainer}>
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={{ marginBottom: 12 }}>
              <Icon name="alert-triangle" size={40} color={theme.colors.accent} />
            </View>
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
              Unable to load products
            </Text>
            <Text
              style={[
                styles.errorMessage,
                { color: theme.colors.textSecondary },
              ]}
            >
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading Products"
              style={({ pressed }) => [
                styles.retryBtn,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={() =>
                fetchProducts(
                  selectedCategory,
                  submittedQuery,
                  selectedSort
                )
              }
            >
              <Text
                style={[
                  styles.retryBtnText,
                  { color: theme.colors.primaryText },
                ]}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.contentWrapper}>
          <FlatList
            key="products-grid-list"
            ref={flatListRef}
            data={products}
            keyExtractor={(item) => `product-${item.id}`}
            numColumns={2}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.columnWrapper}
            ListHeaderComponent={renderListHeader}
            ListFooterComponent={renderListFooter}
            ListEmptyComponent={renderEmptyState}
            renderItem={renderProductItem}
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
            keyboardShouldPersistTaps="handled"
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            onEndReached={loadMoreProducts}
            onEndReachedThreshold={0.4}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={(w, h) => {
              const target = currentScrollOffsetRef.current || lastProductsScreenState?.scrollOffset || 0;
              if (target > 0 && h > target) {
                restoreScrollPosition();
              }
            }}
            onLayout={() => {
              const target = currentScrollOffsetRef.current || lastProductsScreenState?.scrollOffset || 0;
              if (target > 0) {
                restoreScrollPosition();
              }
            }}
          />
          {refreshing && (
            <FullPageContentLoader
              message="Loading Products..."
              overlay
            />
          )}
        </View>
      )}

      {/* Sort Options Modal */}
      <Modal
        visible={isSortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSortModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsSortModalVisible(false)}
        >
          <View
            style={[
              styles.sortModalCard,
              { backgroundColor: theme.colors.card },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Sort Products
              </Text>
              <Pressable
                onPress={() => setIsSortModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close sort options"
              >
                <Icon name="close" size={20} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            {SORT_OPTIONS.map((option) => {
              const isSelected = selectedSort === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={({ pressed }) => [
                    styles.sortOptionRow,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.surfaceSubtle
                        : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => handleSelectSort(option.key)}
                >
                  <Text
                    style={[
                      styles.sortOptionLabel,
                      {
                        color: isSelected
                          ? theme.colors.primary
                          : theme.colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <Icon name="check" size={18} color={theme.colors.primary} strokeWidth={2.5} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
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
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerActionIcon: {
    fontSize: 17,
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
  listHeaderContainer: {
    paddingTop: 2,
    paddingBottom: 4,
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIconBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 6,
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoriesSection: {
    paddingVertical: 5,
  },
  categoriesListContent: {
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  filterSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  countTextGroup: {
    flex: 1,
  },
  productCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryBadgeHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  activeFiltersLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 6,
  },
  filterTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterTagClose: {
    fontSize: 12,
    fontWeight: '700',
  },
  clearAllFiltersBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  clearAllFiltersText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  listFooterContainer: {
    marginTop: 8,
  },
  loadMoreWrapper: {
    width: '100%',
    paddingVertical: 8,
  },
  skeletonGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  skeletonProductCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 8,
  },
  skeletonImagePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 10,
  },
  skeletonContentPlaceholder: {
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  skeletonTextLine: {
    borderRadius: 4,
  },
  loadingMoreSpinnerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loadingMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadMoreErrorCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginVertical: 10,
    alignItems: 'center',
  },
  loadMoreErrorTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadMoreErrorMessage: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 16,
  },
  loadMoreRetryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  loadMoreRetryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  endOfListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 12,
  },
  endOfListDivider: {
    flex: 1,
    height: 1,
  },
  endOfListBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  endOfListText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  errorCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 340,
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 20,
    marginHorizontal: 4,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetFilterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
  },
  resetFilterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sortModalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: '700',
    padding: 4,
  },
  sortOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  sortOptionLabel: {
    fontSize: 14,
  },
  suggestionsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  suggestionsListContent: {
    paddingBottom: 24,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 4,
  },
  suggestionsHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  suggestionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  emptySuggestionsContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  emptySuggestionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySuggestionsSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  suggestionLoadingContainer: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  suggestionLoadingText: {
    fontSize: 13,
  },
});
