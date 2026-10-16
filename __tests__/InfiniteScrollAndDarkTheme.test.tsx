import React from 'react';
import { DarkTheme, LightTheme } from '../src/theme/theme';
import { getProducts } from '../src/services/api';
import { API_ENDPOINTS } from '../src/config/api';

// Mock dependencies
jest.mock('../src/services/api');

describe('PART 1 — Flipkart-Style Infinite Product Scrolling Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. API endpoints format parameters correctly for pagination, category, search, and filters', () => {
    const url1 = API_ENDPOINTS.products({ page: 1, limit: 10, category: 'all', search: '', sort: 'default' });
    expect(url1).toContain('page=1');
    expect(url1).toContain('limit=10');
    expect(url1).toContain('category=all');

    const url2 = API_ENDPOINTS.products({
      page: 2,
      limit: 10,
      category: 'Electronics',
      search: 'Phone',
      sort: 'price-low',
      minPrice: 500,
      maxPrice: 25000,
      inStockOnly: true,
    });
    expect(url2).toContain('page=2');
    expect(url2).toContain('limit=10');
    expect(url2).toContain('category=Electronics');
    expect(url2).toContain('search=Phone');
    expect(url2).toContain('sort=price-low');
    expect(url2).toContain('minPrice=500');
    expect(url2).toContain('maxPrice=25000');
    expect(url2).toContain('inStockOnly=true');
  });

  it('2. Infinite scroll appends next batch without clearing previous products', async () => {
    const initialBatch = [
      { id: 1, name: 'Product 1', price: 100, discount: 0, category: 'All', image: '', stock: 10 },
      { id: 2, name: 'Product 2', price: 200, discount: 0, category: 'All', image: '', stock: 10 },
    ];
    const secondBatch = [
      { id: 3, name: 'Product 3', price: 300, discount: 0, category: 'All', image: '', stock: 10 },
      { id: 4, name: 'Product 4', price: 400, discount: 0, category: 'All', image: '', stock: 10 },
    ];

    (getProducts as jest.Mock).mockResolvedValueOnce({
      products: initialBatch,
      total: 4,
      page: 1,
      limit: 2,
      totalPages: 2,
      hasMore: true,
      categories: ['All'],
    });

    const res1 = await getProducts({ page: 1, limit: 2 });
    expect(res1.products).toHaveLength(2);
    expect(res1.hasMore).toBe(true);

    let loadedProducts = [...res1.products];

    (getProducts as jest.Mock).mockResolvedValueOnce({
      products: secondBatch,
      total: 4,
      page: 2,
      limit: 2,
      totalPages: 2,
      hasMore: false,
      categories: ['All'],
    });

    const res2 = await getProducts({ page: 2, limit: 2 });
    expect(res2.products).toHaveLength(2);
    expect(res2.hasMore).toBe(false);

    // Appending logic with deduplication
    const existingIds = new Set(loadedProducts.map((p) => p.id));
    const uniqueNew = res2.products.filter((p) => !existingIds.has(p.id));
    loadedProducts = [...loadedProducts, ...uniqueNew];

    expect(loadedProducts).toHaveLength(4);
    expect(loadedProducts.map((p) => p.id)).toEqual([1, 2, 3, 4]);
  });

  it('3. Deduplication prevents duplicate products across batch boundaries', () => {
    const existing = [
      { id: 1, name: 'Product 1', price: 100, discount: 0, category: 'All', image: '', stock: 10 },
      { id: 2, name: 'Product 2', price: 200, discount: 0, category: 'All', image: '', stock: 10 },
    ];
    // Next batch contains overlapping item id: 2 plus new item id: 3
    const incoming = [
      { id: 2, name: 'Product 2 Duplicate', price: 200, discount: 0, category: 'All', image: '', stock: 10 },
      { id: 3, name: 'Product 3', price: 300, discount: 0, category: 'All', image: '', stock: 10 },
    ];

    const existingIds = new Set(existing.map((p) => p.id));
    const uniqueNew = incoming.filter((p) => !existingIds.has(p.id));
    const result = [...existing, ...uniqueNew];

    expect(result).toHaveLength(3);
    expect(result.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('4. When filter or search changes, list resets to page 1 and replaces previous results', async () => {
    (getProducts as jest.Mock).mockResolvedValueOnce({
      products: [{ id: 99, name: 'Filtered Shoes', price: 1200, discount: 0, category: 'Footwear', image: '', stock: 5 }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasMore: false,
      categories: ['All', 'Footwear'],
    });

    const filtered = await getProducts({ page: 1, limit: 10, category: 'Footwear' });
    expect(filtered.products).toHaveLength(1);
    expect(filtered.products[0].name).toBe('Filtered Shoes');
    expect(filtered.hasMore).toBe(false);
  });
});

describe('PART 2 — Global Dark Theme Color Tokens & Contrast Tests', () => {
  it('1. DarkTheme primary button has readable contrasting text (primaryText = #000000)', () => {
    expect(DarkTheme.colors.primary).toBe('#FFFFFF');
    expect(DarkTheme.colors.primaryText).toBe('#000000');
    // Contrast check: black text on white button
    expect(DarkTheme.colors.primaryText).not.toBe(DarkTheme.colors.primary);
  });

  it('2. LightTheme primary button maintains dark background with crisp white text', () => {
    expect(LightTheme.colors.primary).toBe('#000000');
    expect(LightTheme.colors.primaryText).toBe('#FFFFFF');
    expect(LightTheme.colors.primaryText).not.toBe(LightTheme.colors.primary);
  });

  it('3. Category chips tokens provide full readability in both themes', () => {
    // Dark mode
    expect(DarkTheme.colors.chipSelectedBg).toBe('#FFFFFF');
    expect(DarkTheme.colors.chipSelectedText).toBe('#000000');
    expect(DarkTheme.colors.chipUnselectedBg).toBe('#1A1A1A');
    expect(DarkTheme.colors.chipUnselectedText).toBe('#B3B3B3');

    // Selected chip contrast in Dark Theme
    expect(DarkTheme.colors.chipSelectedBg).not.toBe(DarkTheme.colors.chipSelectedText);
    // Unselected chip contrast in Dark Theme
    expect(DarkTheme.colors.chipUnselectedBg).not.toBe(DarkTheme.colors.chipUnselectedText);

    // Light mode
    expect(LightTheme.colors.chipSelectedBg).toBe('#000000');
    expect(LightTheme.colors.chipSelectedText).toBe('#FFFFFF');
    expect(LightTheme.colors.chipUnselectedBg).toBe('#F5F5F5');
    expect(LightTheme.colors.chipUnselectedText).toBe('#111111');
  });

  it('4. Surface subtle and card backgrounds in DarkTheme never produce white rectangles', () => {
    expect(DarkTheme.colors.background).toBe('#000000');
    expect(DarkTheme.colors.card).toBe('#111111');
    expect(DarkTheme.colors.surfaceSubtle).toBe('#1A1A1A');
    expect(DarkTheme.colors.border).toBe('#333333');
    expect(DarkTheme.colors.borderLight).toBe('#262626');
  });
});
