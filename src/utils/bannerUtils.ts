import type { Product } from '../types/product';

export type BannerDestination =
  | { type: 'category'; category: string }
  | { type: 'product'; productId: number }
  | { type: 'promotion'; category?: string }
  | null;

/**
 * Generates one representative banner per available product category.
 *
 * Requirements:
 * - Dynamically generate banners for every available product category that has products.
 * - Each category has its own banner featuring one representative product.
 * - Displays category name, product name, discount percentage or offer, product image, and Shop Now.
 * - Selects in-stock product with highest discount for each category.
 * - Gracefully handles categories with no products by skipping without broken UI.
 * - Uses real category, product, image, and discount data.
 */
export function buildCategoryBanners(
  categories: string[],
  products: Product[],
  serverBanners: Product[] = []
): Product[] {
  const result: Product[] = [];
  const usedProductIds = new Set<number>();

  // Collect all unique target categories excluding 'All'
  const targetCategories: string[] = [];
  const seenCats = new Set<string>();

  const addCategory = (rawCat?: string) => {
    const trimmed = rawCat?.trim();
    if (!trimmed || trimmed.toLowerCase() === 'all' || trimmed === 'ShopEasy Deals') {
      return;
    }
    const lower = trimmed.toLowerCase();
    if (!seenCats.has(lower)) {
      seenCats.add(lower);
      targetCategories.push(trimmed);
    }
  };

  const validCategories = (categories || []).filter(
    (c) => c && c.trim().toLowerCase() !== 'all' && c.trim() !== 'ShopEasy Deals'
  );

  if (validCategories.length > 0) {
    validCategories.forEach(addCategory);
  } else {
    // Fall back to categories discovered from products and server banners
    products.forEach((p) => addCategory(p.category));
    serverBanners.forEach((b) => addCategory(b.category));
  }

  for (const category of targetCategories) {
    const catLower = category.toLowerCase();

    // 1. Check if serverBanners already has a representative product for this category
    const serverMatch = serverBanners.find(
      (b) =>
        b.category?.trim().toLowerCase() === catLower &&
        Boolean(b.image) &&
        Boolean(b.name) &&
        !usedProductIds.has(b.id)
    );

    if (serverMatch) {
      result.push({
        ...serverMatch,
        category,
        targetType: 'category',
      });
      usedProductIds.add(serverMatch.id);
      continue;
    }

    // 2. Select from products pool
    const matchingProducts = products.filter(
      (p) =>
        p.category?.trim().toLowerCase() === catLower &&
        Boolean(p.name) &&
        Boolean(p.image)
    );

    if (matchingProducts.length === 0) {
      // Gracefully skip empty categories
      continue;
    }

    // Prefer in-stock products
    const inStockProducts = matchingProducts.filter((p) => p.stock > 0);
    const candidateList =
      inStockProducts.length > 0 ? inStockProducts : matchingProducts;

    // Sort by highest discount, then id descending
    const sorted = [...candidateList].sort((a, b) => {
      const discDiff = (b.discount || 0) - (a.discount || 0);
      if (discDiff !== 0) return discDiff;
      return (b.id || 0) - (a.id || 0);
    });

    // Find unused product or fallback to best
    const chosen =
      sorted.find((p) => !usedProductIds.has(p.id)) || sorted[0];

    if (chosen) {
      result.push({
        ...chosen,
        category,
        targetType: 'category',
      });
      usedProductIds.add(chosen.id);
    }
  }

  return result;
}

/**
 * Resolves the destination of a promotional banner based on its metadata.
 *
 * Requirements:
 * - Category banner -> opens Products screen filtered to that category.
 * - Product banner -> opens Product Details screen for that product.
 * - General promotion -> opens product listing or promotion page.
 * - Graceful fallback -> returns null if no valid destination exists.
 * - Uses actual category names/IDs and product IDs without hardcoded mappings.
 */
export function resolveBannerDestination(
  banner?: Partial<Product> | null
): BannerDestination {
  if (!banner) return null;

  const rawTargetType = (
    banner.targetType ||
    banner.type ||
    banner.bannerType
  )
    ?.toString()
    .trim()
    .toLowerCase();

  // 1. Explicit targetType / type
  if (rawTargetType === 'product' || banner.isProduct) {
    const prodId = banner.productId ?? banner.id;
    if (typeof prodId === 'number' && Number.isFinite(prodId) && prodId > 0) {
      return { type: 'product', productId: prodId };
    }
    return null;
  }

  if (rawTargetType === 'category' || banner.isCategory) {
    const cat = (
      banner.category ||
      banner.categoryName ||
      (typeof banner.categoryId === 'string' ? banner.categoryId : '')
    )
      ?.toString()
      .trim();

    if (cat && cat.toLowerCase() !== 'all') {
      return { type: 'category', category: cat };
    }
    return { type: 'promotion' };
  }

  if (rawTargetType === 'promotion' || banner.isPromotion) {
    const cat = (banner.category || banner.categoryName)?.toString().trim();
    if (cat && cat.toLowerCase() !== 'all' && cat !== 'ShopEasy Deals') {
      return { type: 'promotion', category: cat };
    }
    return { type: 'promotion' };
  }

  // 2. Specific field hints
  if (
    typeof banner.productId === 'number' &&
    banner.productId > 0 &&
    !banner.categoryId
  ) {
    return { type: 'product', productId: banner.productId };
  }

  if (banner.categoryId && !banner.productId) {
    const cat = (
      banner.category ||
      banner.categoryName ||
      String(banner.categoryId)
    ).trim();
    if (cat && cat.toLowerCase() !== 'all') {
      return { type: 'category', category: cat };
    }
  }

  // 3. Fallback mock / deal banners
  if (
    banner.category === 'ShopEasy Deals' ||
    (banner.id === 0 &&
      (!banner.category ||
        banner.category.trim() === '' ||
        banner.category.toLowerCase() === 'all'))
  ) {
    return { type: 'promotion' };
  }

  // 4. If banner has a valid category name:
  // Note: Backend getCategoryBannerProducts returns products representing categories.
  const cat = (banner.category || banner.categoryName)?.toString().trim();
  if (cat && cat.toLowerCase() !== 'all') {
    return { type: 'category', category: cat };
  }

  // 5. If banner has a valid product ID but no category:
  if (
    typeof banner.id === 'number' &&
    Number.isFinite(banner.id) &&
    banner.id > 0
  ) {
    return { type: 'product', productId: banner.id };
  }

  // 6. No valid destination
  return null;
}
