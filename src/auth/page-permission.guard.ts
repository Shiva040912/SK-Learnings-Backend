import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PageKey, PagePermissionsMap } from './page-keys';
import { REQUIRED_PAGES_KEY } from './page-permission.decorator';

interface RequestUser {
  userId: string;
  email: string;
  role: string;
  pagePermissions?: PagePermissionsMap;
}

@Injectable()
export class PagePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPages = this.reflector.getAllAndOverride<PageKey[]>(
      REQUIRED_PAGES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPages || requiredPages.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('You do not have access to this page');
    }

    // Admins always have full access — the permission system decides access
    // for everyone else, but never has the power to lock an admin out.
    if (user.role === 'admin') {
      return true;
    }

    const permissions = user.pagePermissions || {};

    const isAllowed = requiredPages.some((page) => permissions[page] === true);

    if (!isAllowed) {
      throw new ForbiddenException('You do not have access to this page');
    }

    return true;
  }
}
