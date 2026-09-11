import { SetMetadata } from '@nestjs/common';

import { SettingsActionKey } from './settings-permission-keys';

export const REQUIRED_SETTINGS_ACTION_KEY = 'requiredSettingsAction';

// Gates a route behind one Settings-page section action, e.g.
// @RequireSettingsAction('feeSettings'). Always pair with
// @RequirePage('settings') (or the payments-shared override on
// getFeeSettings) — this decorator only narrows access further, it never
// grants page access.
export const RequireSettingsAction = (action: SettingsActionKey) =>
  SetMetadata(REQUIRED_SETTINGS_ACTION_KEY, action);
