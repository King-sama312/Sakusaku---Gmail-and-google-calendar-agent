/**
 * Gmail category label IDs and their display names.
 * These are system labels that Gmail uses to categorize emails.
 */

export const GMAIL_CATEGORIES = {
  CATEGORY_PERSONAL: "Primary",
  CATEGORY_SOCIAL: "Social",
  CATEGORY_PROMOTIONS: "Promotions",
  CATEGORY_UPDATES: "Updates",
  CATEGORY_FORUMS: "Forums",
} as const;

export type GmailCategoryId = keyof typeof GMAIL_CATEGORIES;

/**
 * Get all category label IDs.
 */
export function getCategoryLabelIds(): string[] {
  return Object.keys(GMAIL_CATEGORIES);
}

/**
 * Get display name for a category label ID.
 * Returns undefined if not a category label.
 */
export function getCategoryDisplayName(labelId: string): string | undefined {
  return GMAIL_CATEGORIES[labelId as GmailCategoryId];
}

/**
 * Check if a label ID is a Gmail category.
 */
export function isGmailCategory(labelId: string): boolean {
  return labelId in GMAIL_CATEGORIES;
}
