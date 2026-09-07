import { ClothingCategory } from '../types';

export interface CategoryInfo {
  code: string;
  prefix: string;
  name: ClothingCategory;
}

export const CATEGORY_MAP: Record<ClothingCategory, CategoryInfo> = {
  'Saree': { code: '10', prefix: 'SAR', name: 'Saree' },
  'Salwar Suit': { code: '20', prefix: 'SLW', name: 'Salwar Suit' },
  'Kurti': { code: '30', prefix: 'KRT', name: 'Kurti' },
  'Dupatta & Stole': { code: '40', prefix: 'DUP', name: 'Dupatta & Stole' },
  'Fabric & Material': { code: '50', prefix: 'FAB', name: 'Fabric & Material' },
};

/**
 * Returns the 2-digit numerical category code (e.g. "10" for Saree)
 */
export function getCategoryCode(category: string): string {
  if (category in CATEGORY_MAP) {
    return CATEGORY_MAP[category as ClothingCategory].code;
  }
  return '90';
}

/**
 * Returns the clothing category name given a barcode
 */
export function detectCategoryFromBarcode(barcode: string): ClothingCategory | null {
  const clean = barcode.replace(/[^0-9]/g, '');
  if (clean.startsWith('10')) return 'Saree';
  if (clean.startsWith('20')) return 'Salwar Suit';
  if (clean.startsWith('30')) return 'Kurti';
  if (clean.startsWith('40')) return 'Dupatta & Stole';
  return null;
}

/**
 * Parses a structured barcode into category number and item ID
 */
export function parseStructuredBarcode(barcode: string): {
  categoryCode: string;
  categoryName: string;
  itemId: string;
} {
  const clean = barcode.replace(/[^0-9]/g, '');
  let categoryCode = '90';
  let categoryName = 'Clothing Item';
  let itemId = clean;

  if (clean.startsWith('10')) {
    categoryCode = '10';
    categoryName = 'Saree';
    itemId = clean.slice(2);
  } else if (clean.startsWith('20')) {
    categoryCode = '20';
    categoryName = 'Salwar Suit';
    itemId = clean.slice(2);
  } else if (clean.startsWith('30')) {
    categoryCode = '30';
    categoryName = 'Kurti';
    itemId = clean.slice(2);
  } else if (clean.startsWith('40')) {
    categoryCode = '40';
    categoryName = 'Dupatta & Stole';
    itemId = clean.slice(2);
  }

  return {
    categoryCode,
    categoryName,
    itemId: itemId || '0001',
  };
}

/**
 * Generates a unique barcode containing the category number and unique item ID
 * e.g., For Saree (Code 10), generates: "1000001", "1000002", etc.
 */
export function generateStructuredBarcode(
  category: ClothingCategory,
  existingProducts: { barcode: string }[]
): {
  barcode: string;
  categoryCode: string;
  itemId: string;
  formattedSku: string;
} {
  const info = CATEGORY_MAP[category] || { code: '90', prefix: 'CLT', name: category };
  const catCode = info.code;

  // Find all existing barcodes starting with this category code
  let maxNumericId = 0;
  for (const prod of existingProducts) {
    if (prod.barcode && prod.barcode.startsWith(catCode)) {
      const remainingDigits = prod.barcode.slice(catCode.length);
      const val = parseInt(remainingDigits, 10);
      if (!isNaN(val) && val > maxNumericId) {
        maxNumericId = val;
      }
    }
  }

  // Next sequential unique ID
  let nextId = maxNumericId + 1;
  let candidateBarcode = '';
  let candidateItemId = '';

  // Ensure global uniqueness across any existing items
  do {
    // 5-digit padded item sequence, e.g. "00001", "00002"
    candidateItemId = nextId.toString().padStart(5, '0');
    // Resulting barcode: e.g. "1000001" (Starts with 10 for Saree + 00001 for Item 1)
    candidateBarcode = `${catCode}${candidateItemId}`;
    nextId++;
  } while (existingProducts.some((p) => p.barcode === candidateBarcode));

  const formattedSku = `${info.prefix}-${catCode}-${candidateItemId}`;

  return {
    barcode: candidateBarcode,
    categoryCode: catCode,
    itemId: candidateItemId,
    formattedSku,
  };
}
