import { ForbiddenException } from '@nestjs/common';

import {
  GranularPermissionsMap,
  normalizeGranularPermissions,
} from '../auth/student-permission-keys';
import {
  SETTINGS_FIELD_ACTION_MAP,
  hasSettingsAction,
} from '../auth/settings-permission-keys';

interface RequestUser {
  role: string;
  granularPermissions?: GranularPermissionsMap;
}

// Applies the Settings page's own section actions to the general GET
// /settings response — the one call the Settings page uses to hydrate every
// tab at once. A user only sees the keys belonging to a section they were
// actually granted; this is a read-side redaction (partial data), not a
// rejection, matching the Payments/Notifications/Invoices Fields pattern.
export function redactSettingsForUser<T extends Record<string, unknown>>(
  settings: T,
  user: RequestUser | undefined,
): T {
  if (!user || user.role === 'admin') {
    return settings;
  }

  const permissions = normalizeGranularPermissions(
    user.granularPermissions,
  ).settings;

  const plain = { ...settings };

  for (const [key, action] of Object.entries(SETTINGS_FIELD_ACTION_MAP)) {
    if (!hasSettingsAction(permissions, action) && key in plain) {
      delete plain[key];
    }
  }

  return plain;
}

// Applies the Settings page's own section actions to a PATCH /settings
// write — unlike the GET side, a write touching a section the user was not
// granted is rejected outright (403) rather than silently ignored, since a
// direct/crafted API call attempting to write Fee/Notification/Invoice
// settings without that section's permission must not be allowed to
// silently no-op into an inconsistent partial save.
export function assertSettingsWriteAllowed(
  updateDto: Record<string, unknown>,
  user: RequestUser | undefined,
): void {
  if (!user || user.role === 'admin') {
    return;
  }

  const permissions = normalizeGranularPermissions(
    user.granularPermissions,
  ).settings;

  for (const [key, value] of Object.entries(updateDto)) {
    if (value === undefined) continue;

    const requiredAction = SETTINGS_FIELD_ACTION_MAP[key];

    if (requiredAction && !hasSettingsAction(permissions, requiredAction)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
  }
}
