// Single source of truth for the Notifications page's granular permission
// shape: Actions (what a user can DO) and Fields (what notification data
// they can see — one flag per field, controlling every place that field is
// displayed: table column, per-row subtext and the preferences menu alike).
// There is deliberately no separate "columns" vs "details" concept — a
// field is visible everywhere or nowhere for a given user, never configured
// twice.
export const NOTIFICATION_ACTION_KEYS = [
  'search',
  'filter',
  'refresh',
  'sendNotification',
  'sendToAll',
  'sendIndividualSelected',
  'sendReminder',
  'notificationPreferences',
] as const;

export type NotificationActionKey = (typeof NOTIFICATION_ACTION_KEYS)[number];
export type NotificationActionsMap = Record<NotificationActionKey, boolean>;

// One entry per actual notification data field shown on the Notifications
// page, named after the actual NotificationItem/service field where one
// exists (feeEndingDate, alertType) rather than inventing new names.
export const NOTIFICATION_FIELD_KEYS = [
  'studentName',
  'rollNo',
  'course',
  'batch',
  'pendingAmount',
  'paidAmount',
  'feeEndingDate',
  'alertType',
  'reminderCount',
  'lastReminderSentAt',
  'nextReminderDate',
  'paymentStatus',
  'muteAll',
  'muteReminder',
] as const;

export type NotificationFieldKey = (typeof NOTIFICATION_FIELD_KEYS)[number];
export type NotificationFieldsMap = Record<NotificationFieldKey, boolean>;

export interface NotificationPermissions {
  actions: NotificationActionsMap;
  fields: NotificationFieldsMap;
}

// Actions are deny-by-default — an Admin has to explicitly grant each one.
export const createDefaultNotificationActions = (): NotificationActionsMap =>
  NOTIFICATION_ACTION_KEYS.reduce((actions, key) => {
    actions[key] = false;
    return actions;
  }, {} as NotificationActionsMap);

// Fields are visible-by-default — turning Notifications page access on
// shows the full table/menu exactly as before, until an Admin deliberately
// hides a field.
export const createDefaultNotificationFields = (): NotificationFieldsMap =>
  NOTIFICATION_FIELD_KEYS.reduce((fields, key) => {
    fields[key] = true;
    return fields;
  }, {} as NotificationFieldsMap);

export const createDefaultNotificationPermissions =
  (): NotificationPermissions => ({
    actions: createDefaultNotificationActions(),
    fields: createDefaultNotificationFields(),
  });

// Deliberately reads each key via property access (`actions?.[key]`) instead
// of object-spreading `actions` wholesale — see the identical note on
// normalizeStudentActions in student-permission-keys.ts. `actions` is
// sometimes a live Mongoose (sub)document rather than a plain object, and
// spread does not read Mongoose's getter-based schema fields.
export const normalizeNotificationActions = (
  actions?: Partial<NotificationActionsMap> | null,
): NotificationActionsMap => {
  const merged = createDefaultNotificationActions();

  for (const key of NOTIFICATION_ACTION_KEYS) {
    const value = actions?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  return merged;
};

export const normalizeNotificationFields = (
  fields?: Partial<NotificationFieldsMap> | null,
): NotificationFieldsMap => {
  const merged = createDefaultNotificationFields();

  for (const key of NOTIFICATION_FIELD_KEYS) {
    const value = fields?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  return merged;
};

export interface NotificationPermissionsInput {
  actions?: Partial<NotificationActionsMap> | null;
  fields?: Partial<NotificationFieldsMap> | null;
}

export const normalizeNotificationPermissions = (
  permissions?: NotificationPermissionsInput | null,
): NotificationPermissions => ({
  actions: normalizeNotificationActions(permissions?.actions),
  fields: normalizeNotificationFields(permissions?.fields),
});

// "Send to All" and "Send Individual/Selected" are sub-actions of "Send
// Notification" — they are never independently effective. A stored
// `sendToAll: true` next to `sendNotification: false` can never grant
// access, so callers never need to know about the parent/child
// relationship themselves.
export const hasNotificationAction = (
  permissions: NotificationPermissions | undefined | null,
  action: NotificationActionKey,
): boolean => {
  if (!permissions) return false;

  if (action === 'sendToAll' || action === 'sendIndividualSelected') {
    return (
      permissions.actions?.sendNotification === true &&
      permissions.actions?.[action] === true
    );
  }

  return permissions.actions?.[action] === true;
};
