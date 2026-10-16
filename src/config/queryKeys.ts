export const queryKeys = {
  // Public Catalog
  products: (category?: string, search?: string, sort?: string, page?: number) =>
    ['products', { category: category || 'all', search: search || '', sort: sort || 'default', page: page || 1 }] as const,
  allProducts: ['products', 'all'] as const,
  bannerProducts: ['products', 'banners'] as const,
  homeData: ['home', 'overview'] as const,
  product: (productId: number) => ['product', productId] as const,
  categories: ['categories'] as const,
  categoryProducts: (category: string) => ['products', 'category', category] as const,

  // Customer Specific
  orders: (userId?: number | string | null, status?: string) =>
    status && status !== 'ALL'
      ? (['orders', userId || 'me', status] as const)
      : (['orders', userId || 'me'] as const),
  ordersPage: (userId?: number | string | null, page: number = 1, limit: number = 10, status?: string) =>
    ['orders', userId || 'me', 'page', page, limit, status || 'ALL'] as const,
  order: (orderId: number) => ['order', orderId] as const,
  orderTracking: (orderId: number) => ['orderTracking', orderId] as const,
  addresses: (userId?: number | string | null) => ['addresses', userId || 'me'] as const,
  notifications: (userId?: number | string | null) => ['notifications', userId || 'me'] as const,
  cart: (userId?: number | string | null) => ['cart', userId || 'me'] as const,
  wishlist: (userId?: number | string | null) => ['wishlist', userId || 'me'] as const,
  reviews: (productId: number) => ['reviews', productId] as const,
  supportFaqs: ['support', 'faqs'] as const,
  supportTickets: (userId?: number | string | null) => ['support', 'tickets', userId || 'me'] as const,

  // Admin Specific
  adminOverview: ['admin', 'overview'] as const,
  adminOrders: (status?: string, search?: string) =>
    ['admin', 'orders', { status: status || 'ALL', search: search || '' }] as const,
  adminProducts: (category?: string, search?: string, sort?: string) =>
    ['admin', 'products', { category: category || 'ALL', search: search || '', sort: sort || 'default' }] as const,
  adminCategories: ['admin', 'categories'] as const,
  adminUsers: (search?: string, role?: string) =>
    ['admin', 'users', { search: search || '', role: role || 'ALL' }] as const,
  adminUserDetail: (userId: number) => ['admin', 'user', userId] as const,
  adminCoupons: (search?: string, status?: string) =>
    ['admin', 'coupons', { search: search || '', status: status || 'ALL' }] as const,
  adminReviews: (page: number = 1, search?: string, rating?: string) =>
    ['admin', 'reviews', { page, search: search || '', rating: rating || 'ALL' }] as const,
  adminRegistrations: (search?: string, status?: string) =>
    ['admin', 'registrations', { search: search || '', status: status || 'ALL' }] as const,
  adminAnalyticsStatus: (filter?: string) =>
    ['admin', 'analytics', 'status', filter || 'ALL'] as const,
  adminAnalyticsSales: (period?: string) =>
    ['admin', 'analytics', 'sales', period || 'date'] as const,
};
