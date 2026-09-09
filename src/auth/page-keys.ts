export const PAGE_KEYS = [
  'dashboard',
  'students',
  'payments',
  'invoices',
  'notifications',
  'users',
  'settings',
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export type PagePermissionsMap = Record<PageKey, boolean>;

export function createEmptyPagePermissions(): PagePermissionsMap {
  return PAGE_KEYS.reduce((permissions, key) => {
    permissions[key] = false;
    return permissions;
  }, {} as PagePermissionsMap);
}
