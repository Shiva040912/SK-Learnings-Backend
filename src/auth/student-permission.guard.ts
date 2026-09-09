import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  GranularPermissionsMap,
  StudentActionKey,
  hasStudentAction,
  normalizeStudentPermissions,
} from './student-permission-keys';
import { PagePermissionsMap } from './page-keys';
import { REQUIRED_STUDENT_ACTION_KEY } from './student-permission.decorator';

interface RequestUser {
  userId: string;
  email: string;
  role: string;
  pagePermissions?: PagePermissionsMap;
  granularPermissions?: GranularPermissionsMap;
}

// A handful of Student routes are shared resources reachable from more than
// one frontend page, and the "other" page doesn't have its own granular
// permissions yet — so a user reaching the route via that other page's
// access keeps today's fully-unrestricted behavior. This table says, per
// action, which page bypasses the Students-specific check:
//  - addCourse/deleteCourse/addBatch/deleteBatch: Course/Batch setup is
//    also managed from the Settings page (Course & Batch tab).
//  - view: the full, unredacted student list is also fetched by the
//    Payments page to build its fee-management table.
const ACTION_PAGE_BYPASS: Partial<
  Record<StudentActionKey, keyof PagePermissionsMap>
> = {
  addCourse: 'settings',
  deleteCourse: 'settings',
  addBatch: 'settings',
  deleteBatch: 'settings',
  view: 'payments',
};

@Injectable()
export class StudentActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAction = this.reflector.getAllAndOverride<
      StudentActionKey | undefined
    >(REQUIRED_STUDENT_ACTION_KEY, [context.getHandler(), context.getClass()]);

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

    const studentPermissions = normalizeStudentPermissions(
      user.granularPermissions?.students,
    );

    if (!hasStudentAction(studentPermissions, requiredAction)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
