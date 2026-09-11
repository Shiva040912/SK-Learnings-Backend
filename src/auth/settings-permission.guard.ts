import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  GranularPermissionsMap,
  normalizeGranularPermissions,
} from './student-permission-keys';
import { SettingsActionKey, hasSettingsAction } from './settings-permission-keys';
import { PagePermissionsMap } from './page-keys';
import { REQUIRED_SETTINGS_ACTION_KEY } from './settings-permission.decorator';

interface RequestUser {
  userId: string;
  email: string;
  role: string;
  pagePermissions?: PagePermissionsMap;
  granularPermissions?: GranularPermissionsMap;
}

// getFeeSettings is also the source for the Payments page's Fee Setup UI
// (see SettingsController's class-level comment on that route) — Payments
// has no equivalent granular permission of its own for this data, so a
// user reaching it via Payments page access keeps that existing,
// intentional behavior. Same ACTION_PAGE_BYPASS pattern already used by
// StudentActionGuard.
const ACTION_PAGE_BYPASS: Partial<
  Record<SettingsActionKey, keyof PagePermissionsMap>
> = {
  feeSettings: 'payments',
};

@Injectable()
export class SettingsActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAction = this.reflector.getAllAndOverride<
      SettingsActionKey | undefined
    >(REQUIRED_SETTINGS_ACTION_KEY, [
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

    const bypassPage = ACTION_PAGE_BYPASS[requiredAction];

    if (bypassPage && user.pagePermissions?.[bypassPage] === true) {
      return true;
    }

    const settingsPermissions = normalizeGranularPermissions(
      user.granularPermissions,
    ).settings;

    if (!hasSettingsAction(settingsPermissions, requiredAction)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
