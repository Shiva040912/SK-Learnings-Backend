import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  NotificationActionKey,
  hasNotificationAction,
  normalizeNotificationPermissions,
} from './notification-permission-keys';
import { GranularPermissionsMap } from './student-permission-keys';
import { REQUIRED_NOTIFICATION_ACTION_KEY } from './notification-permission.decorator';

interface RequestUser {
  userId: string;
  email: string;
  role: string;
  granularPermissions?: GranularPermissionsMap;
}

@Injectable()
export class NotificationActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAction = this.reflector.getAllAndOverride<
      NotificationActionKey | undefined
    >(REQUIRED_NOTIFICATION_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredAction) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    if (user.role === 'admin') {
      return true;
    }

    const notificationPermissions = normalizeNotificationPermissions(
      user.granularPermissions?.notifications,
    );

    if (!hasNotificationAction(notificationPermissions, requiredAction)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
