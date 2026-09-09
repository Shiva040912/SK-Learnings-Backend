import { SetMetadata } from '@nestjs/common';

import { NotificationActionKey } from './notification-permission-keys';

export const REQUIRED_NOTIFICATION_ACTION_KEY = 'requiredNotificationAction';

// Gates a route behind one Notifications-page granular action, e.g.
// @RequireNotificationAction('sendReminder'). Always pair with
// @RequirePage('notifications') — this decorator only narrows access
// further, it never grants page access.
//
// 'sendToAll' and 'sendIndividualSelected' are sub-actions of
// 'sendNotification' — hasNotificationAction (checked by the guard) already
// ANDs them with the parent action, so a route can require just the
// specific sub-action, e.g. @RequireNotificationAction('sendToAll').
export const RequireNotificationAction = (action: NotificationActionKey) =>
  SetMetadata(REQUIRED_NOTIFICATION_ACTION_KEY, action);
