import {
  API_ENDPOINTS,
  getApiBaseUrl,
  setApiBaseUrl,
  CANDIDATE_BASE_URLS,
} from '../config/api';
import type { Product, ProductsResponse, GetProductsParams } from '../types/product';

const REQUEST_TIMEOUT_MS = 6000;

async function executeFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const finalHeaders: Record<string, string> = {
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers: finalHeaders,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (timedOut || err?.name === 'AbortError' || err?.message === 'Aborted') {
      const timeoutError = new Error(`Connection timed out after ${timeoutMs}ms while connecting to ${url}`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes a request against the active base URL, and automatically falls back
 * across other candidate hosts (10.0.2.2, localhost via adb reverse, or LAN IP)
 * if a network error occurs.
 * Appends a timestamp cache-buster to GET requests to guarantee fresh database records.
 */
export async function fetchWithFallback(endpointPath: string, options: RequestInit = {}): Promise<Response> {
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  let pathWithBuster = endpointPath;

  if (isGet) {
    const separator = endpointPath.includes('?') ? '&' : '?';
    pathWithBuster = `${endpointPath}${separator}_t=${Date.now()}`;
  }

  const currentBase = getApiBaseUrl();
  const primaryUrl = `${currentBase}${pathWithBuster}`;

  try {
    const res = await executeFetch(primaryUrl, options, REQUEST_TIMEOUT_MS);
    return res;
  } catch (initialError) {
    // If currentBase failed with a network error, try remaining candidates with a faster timeout
    const remainingCandidates = CANDIDATE_BASE_URLS.filter((b) => b !== currentBase);

    for (const candidate of remainingCandidates) {
      try {
        const fallbackUrl = `${candidate}${pathWithBuster}`;
        const fallbackRes = await executeFetch(fallbackUrl, options, 3000);
        if (fallbackRes.ok) {
          // Found working host, save it for all future calls and image URLs
          setApiBaseUrl(candidate);
          return fallbackRes;
        }
      } catch {
        // Continue trying next candidate
      }
    }

    throw new Error(
      'Unable to connect to the backend server. Please verify the server is running on port 3000 and reachable from your device.'
    );
  }
}

/**
 * Fetch paginated products with optional category, search, and sort filtering
 */
export async function getProducts(
  pageOrParams: number | GetProductsParams = 1,
  limit: number = 12,
  category: string = 'all',
  search: string = '',
  sort: string = 'default'
): Promise<ProductsResponse> {
  let endpoint: string;
  let fallbackPage = 1;
  let fallbackLimit = 12;

  if (typeof pageOrParams === 'object' && pageOrParams !== null) {
    endpoint = API_ENDPOINTS.products(pageOrParams);
    fallbackPage = pageOrParams.page ?? 1;
    fallbackLimit = pageOrParams.limit ?? 12;
  } else {
    endpoint = API_ENDPOINTS.products(pageOrParams, limit, category, search, sort);
    fallbackPage = pageOrParams;
    fallbackLimit = limit;
  }

  const response = await fetchWithFallback(endpoint);

  if (!response.ok) {
    throw new Error(`Failed to load products: HTTP ${response.status}`);
  }

  const data = await response.json();

  const totalPages = typeof data?.totalPages === 'number' ? data.totalPages : 1;
  const page = typeof data?.page === 'number' ? data.page : fallbackPage;
  const hasMore =
    typeof data?.hasMore === 'boolean'
      ? data.hasMore
      : page < totalPages;

  return {
    products: Array.isArray(data?.products) ? data.products : [],
    total: typeof data?.total === 'number' ? data.total : 0,
    page,
    limit: typeof data?.limit === 'number' ? data.limit : fallbackLimit,
    totalPages,
    hasMore,
    categories: Array.isArray(data?.categories) ? data.categories : [],
  };
}

/**
 * Fetches all products across all pages matching the given query parameters.
 * Automatically handles backend page size limits (up to 50 per page) and deduplicates by ID.
 */
export async function getAllProducts(
  params: GetProductsParams = {}
): Promise<ProductsResponse> {
  const first = await getProducts({
    ...params,
    page: 1,
    limit: 50,
  });

  let allProducts = [...first.products];

  if (first.totalPages > 1) {
    const promises: Promise<ProductsResponse>[] = [];
    for (let p = 2; p <= first.totalPages; p++) {
      promises.push(
        getProducts({
          ...params,
          page: p,
          limit: 50,
        })
      );
    }
    const results = await Promise.all(promises);
    for (const res of results) {
      if (res?.products) {
        allProducts = allProducts.concat(res.products);
      }
    }
  }

  // Deduplicate products by id to ensure a clean list
  const seen = new Set<number>();
  const uniqueProducts: Product[] = [];
  for (const prod of allProducts) {
    if (prod && typeof prod.id === 'number') {
      if (!seen.has(prod.id)) {
        seen.add(prod.id);
        uniqueProducts.push(prod);
      }
    } else if (prod) {
      uniqueProducts.push(prod);
    }
  }

  return {
    products: uniqueProducts,
    total: uniqueProducts.length,
    page: 1,
    limit: uniqueProducts.length,
    totalPages: 1,
    hasMore: false,
    categories: first.categories,
  };
}

/**
 * Fetch promotional banner products
 */
export async function getBannerProducts(): Promise<Product[]> {
  try {
    const response = await fetchWithFallback(API_ENDPOINTS.banner);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data?.products)) {
      return data.products;
    }
    return [];
  } catch (error) {
    console.warn('Banner products fetch error:', error);
    return [];
  }
}

/**
 * Fetch list of categories
 */
export async function getCategories(): Promise<string[]> {
  try {
    const response = await fetchWithFallback(API_ENDPOINTS.categories);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data
        .map((item: any) => (typeof item === 'string' ? item : item?.name))
        .filter(Boolean);
    }

    return [];
  } catch (error) {
    console.warn('Categories fetch error:', error);
    return [];
  }
}

/**
 * Fetch a single product by its unique ID
 */
export async function getProductById(id: number | string): Promise<Product | null> {
  const numericId = typeof id === 'number' ? id : parseInt(String(id), 10);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return null;
  }

  const endpoint = API_ENDPOINTS.product(numericId);
  try {
    const response = await fetchWithFallback(endpoint);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to load product: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data && typeof data === 'object' && typeof data.id === 'number' ? data : null;
  } catch (error) {
    console.error(`Error fetching product with ID ${id}:`, error);
    throw error;
  }
}
