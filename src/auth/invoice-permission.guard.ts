import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  InvoiceActionKey,
  hasInvoiceAction,
  normalizeInvoicePermissions,
} from './invoice-permission-keys';
import { GranularPermissionsMap } from './student-permission-keys';
import { REQUIRED_INVOICE_ACTION_KEY } from './invoice-permission.decorator';

interface RequestUser {
  userId: string;
  email: string;
  role: string;
  granularPermissions?: GranularPermissionsMap;
}

@Injectable()
export class InvoiceActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAction = this.reflector.getAllAndOverride<
      InvoiceActionKey | undefined
    >(REQUIRED_INVOICE_ACTION_KEY, [context.getHandler(), context.getClass()]);

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

    const invoicePermissions = normalizeInvoicePermissions(
      user.granularPermissions?.invoices,
    );

    if (!hasInvoiceAction(invoicePermissions, requiredAction)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
