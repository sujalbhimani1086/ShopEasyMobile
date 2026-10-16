export interface Product {
  id: number;
  name: string;
  price: number;
  discount: number;
  category: string;
  image: string;
  stock: number;
  averageRating?: number;
  reviewCount?: number;
  createdAt?: string;
  updatedAt?: string;
  targetType?: 'category' | 'product' | 'promotion' | string;
  type?: 'category' | 'product' | 'promotion' | string;
  bannerType?: 'category' | 'product' | 'promotion' | string;
  productId?: number;
  categoryId?: number | string;
  categoryName?: string;
  isProduct?: boolean;
  isCategory?: boolean;
  isPromotion?: boolean;
  featured?: boolean;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore?: boolean;
  categories: string[];
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
}

export interface CategoryItem {
  id?: number;
  name: string;
  icon?: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}
