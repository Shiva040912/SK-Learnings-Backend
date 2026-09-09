// Single source of truth for the Settings page's granular permission shape.
//
// Unlike Students/Payments/Notifications/Invoices, Settings has no per-
// record table — each tab is one coherent admin-configuration form edited
// as a whole by one authorized person at a time. Gating whole SECTIONS
// (view + save, as a single action) is the natural, non-over-engineered
// granularity here; a Fields layer (hide just the GST Number input but show
// the rest of the Invoice Settings form) would not serve any real use case.
//
// Built from the actual Settings.jsx tabs, not guessed:
//  - Profile tab (profile form + change password form) -> profileSettings
//  - Fee Settings tab                                  -> feeSettings
//  - Notifications tab (WhatsApp reminder rules)        -> notificationSettings
//  - Invoice tab                                        -> invoiceSettings
//  - Course & Batch tab: deliberately NOT here. It already reuses the
//    Students page's addCourse/deleteCourse/addBatch/deleteBatch actions —
//    AcademicController already treats Settings page access as a bypass for
//    those (see student-permission.guard.ts's ACTION_PAGE_BYPASS). Adding a
//    second permission for the same capability would duplicate it.
//  - Mobile Layout tab: deliberately NOT here. It is a pure client-side
//    localStorage preference with no backend call at all — nothing to
//    protect.
export const SETTINGS_ACTION_KEYS = [
  'profileSettings',
  'feeSettings',
  'notificationSettings',
  'invoiceSettings',
] as const;

export type SettingsActionKey = (typeof SETTINGS_ACTION_KEYS)[number];
export type SettingsActionsMap = Record<SettingsActionKey, boolean>;

export interface SettingsPermissions {
  actions: SettingsActionsMap;
}

// Actions are deny-by-default — an Admin has to explicitly grant each one.
export const createDefaultSettingsActions = (): SettingsActionsMap =>
  SETTINGS_ACTION_KEYS.reduce((actions, key) => {
    actions[key] = false;
    return actions;
  }, {} as SettingsActionsMap);

export const createDefaultSettingsPermissions = (): SettingsPermissions => ({
  actions: createDefaultSettingsActions(),
});

export const normalizeSettingsActions = (
  actions?: Partial<SettingsActionsMap> | null,
): SettingsActionsMap => {
  const merged = createDefaultSettingsActions();

  for (const key of SETTINGS_ACTION_KEYS) {
    const value = actions?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  return merged;
};

export interface SettingsPermissionsInput {
  actions?: Partial<SettingsActionsMap> | null;
}

export const normalizeSettingsPermissions = (
  permissions?: SettingsPermissionsInput | null,
): SettingsPermissions => ({
  actions: normalizeSettingsActions(permissions?.actions),
});

export const hasSettingsAction = (
  permissions: SettingsPermissions | undefined | null,
  action: SettingsActionKey,
): boolean => {
  if (!permissions) return false;

  return permissions.actions?.[action] === true;
};

// Maps each Settings schema key (from Settings/UpdateSettingsDto) to the
// section action that governs reading/writing it — the single reusable
// answer to "which Settings action controls this field", used by both the
// GET /settings redaction and the PATCH /settings write guard so the two
// can never drift apart.
export const SETTINGS_FIELD_ACTION_MAP: Record<string, SettingsActionKey> = {
  monthlyFeeEnabled: 'feeSettings',
  defaultMonths: 'feeSettings',
  minimumMonths: 'feeSettings',
  maximumMonths: 'feeSettings',
  partialFeeEnabled: 'feeSettings',
  minimumPartialAmount: 'feeSettings',
  yearlyFeeEnabled: 'feeSettings',
  commonFeeSetupEnabled: 'feeSettings',
  courseWiseFeeSetupEnabled: 'feeSettings',
  recurringFeeStartDay: 'feeSettings',
  recurringFeeDueDay: 'feeSettings',

  whatsappEnabled: 'notificationSettings',
  reminderDaysBeforeDue: 'notificationSettings',
  reminderOnDueDate: 'notificationSettings',
  overdueReminderEnabled: 'notificationSettings',
  overdueReminderIntervalDays: 'notificationSettings',

  invoiceEnabled: 'invoiceSettings',
  invoicePrefix: 'invoiceSettings',
  invoiceSuffix: 'invoiceSettings',
  invoiceQrCode: 'invoiceSettings',
  gstNumber: 'invoiceSettings',
  ownerName: 'invoiceSettings',
  invoiceAddress: 'invoiceSettings',
  invoiceFooter: 'invoiceSettings',
  invoiceTerms: 'invoiceSettings',
};
