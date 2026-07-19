/**
 * Pure helpers that derive HR service case routing from a linked service
 * catalog item. Kept dependency-free so the SLA/owner-group derivation logic
 * can be unit tested without spinning up the command bus or a database.
 */

export interface CatalogItemSlaSource {
  slaHours: number;
}

export interface CatalogItemOwnerGroupSource {
  defaultOwnerGroup?: string;
  category?: string;
}

/**
 * Derives the SLA deadline for a new case from the catalog item's configured
 * `slaHours`, measured from the given reference time (defaults to now).
 */
export function deriveSlaDeadlineFromCatalogItem(catalogItem: CatalogItemSlaSource, referenceDate: Date = new Date()): Date {
  return new Date(referenceDate.getTime() + catalogItem.slaHours * 60 * 60 * 1000);
}

/**
 * Derives the suggested owner group for a new case from the catalog item's
 * explicit default owner group, falling back to its category. Returns
 * undefined when the catalog item carries neither.
 */
export function deriveOwnerGroupFromCatalogItem(catalogItem: CatalogItemOwnerGroupSource): string | undefined {
  const defaultOwnerGroup = catalogItem.defaultOwnerGroup?.trim();
  if (defaultOwnerGroup) return defaultOwnerGroup;
  const category = catalogItem.category?.trim();
  return category || undefined;
}
