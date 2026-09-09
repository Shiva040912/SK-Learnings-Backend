import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  PaymentActionKey,
  hasPaymentAction,
  normalizePaymentPermissions,
} from './payment-permission-keys';
import { GranularPermissionsMap } from './student-permission-keys';
import { REQUIRED_PAYMENT_ACTIONS_KEY } from './payment-permission.decorator';

interface RequestUser {
  userId: string;
  email: string;
  role: string;
  granularPermissions?: GranularPermissionsMap;
}

@Injectable()
export class PaymentActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredActions = this.reflector.getAllAndOverride<
      PaymentActionKey[] | undefined
    >(REQUIRED_PAYMENT_ACTIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredActions || requiredActions.length === 0) {
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

    const paymentPermissions = normalizePaymentPermissions(
      user.granularPermissions?.payments,
    );

    const isAllowed = requiredActions.some((action) =>
      hasPaymentAction(paymentPermissions, action),
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
