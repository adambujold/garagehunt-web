// Exact same set/order as the mobile app's constants/categories.ts and the
// public.categories table seed data (supabase/migrations/0001) — category
// ids are real uuids assigned by the DB, never hardcoded here; List a Sale
// resolves names to ids at insert time the same way the mobile app does.
export const CATEGORIES = [
  'Furniture',
  'Kids & baby',
  'Clothing',
  'Tools',
  'Electronics',
  'Sporting goods',
  'Books & media',
  'Kitchenware',
  'Antiques',
  'Garden & outdoor',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];
