import {
  GranularPermissionsMap,
  normalizeGranularPermissions,
} from '../auth/student-permission-keys';

interface RequestUser {
  role: string;
  granularPermissions?: GranularPermissionsMap;
}

// Applies the Notifications page's Fields permissions to one notification
// item. `muteAll`/`muteReminder` live nested under `notificationPreferences`
// rather than as top-level keys — everything else is top-level — so both
// shapes are handled here rather than duplicating this field list anywhere
// else.
export function redactNotificationForUser<T extends Record<string, unknown>>(
  item: T,
  user: RequestUser | undefined,
): T {
  if (!user || user.role === 'admin') {
    return item;
  }

  const { fields } = normalizeGranularPermissions(
    user.granularPermissions,
  ).notifications;

  const plain: Record<string, unknown> = { ...item };

  const topLevelFieldKeys = [
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
  ] as const;

  for (const field of topLevelFieldKeys) {
    if (fields[field] !== true) {
      delete plain[field];
    }
  }

  const preferences = plain.notificationPreferences as
    Record<string, unknown> | undefined;

  if (preferences) {
    const nextPreferences = { ...preferences };

    if (fields.muteAll !== true) delete nextPreferences.muteAll;
    if (fields.muteReminder !== true) delete nextPreferences.muteReminder;

    plain.notificationPreferences = nextPreferences;
  }

  return plain as T;
}

export function redactNotificationListForUser<
  T extends Record<string, unknown>,
>(items: T[], user: RequestUser | undefined): T[] {
  return items.map((item) => redactNotificationForUser(item, user));
}
