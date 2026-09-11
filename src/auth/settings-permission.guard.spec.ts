import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SettingsActionGuard } from './settings-permission.guard';

// H1 (Settings sub-endpoint permission bypass) regression coverage: each
// Settings sub-endpoint (fees/notifications/invoice) must enforce its own
// granular section action, not just page access.
describe('SettingsActionGuard (H1)', () => {
  const buildContext = (
    user: Record<string, unknown> | undefined,
    requiredAction: string | undefined,
  ): { context: ExecutionContext; reflector: Reflector } => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredAction),
    } as unknown as Reflector;

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;

    return { context, reflector };
  };

  const activate = (
    user: Record<string, unknown> | undefined,
    requiredAction: string | undefined,
  ) => {
    const { context, reflector } = buildContext(user, requiredAction);
    const guard = new SettingsActionGuard(reflector);

    return guard.canActivate(context);
  };

  it('lets admin through regardless of granular permissions', () => {
    expect(activate({ role: 'admin' }, 'invoiceSettings')).toBe(true);
  });

  it('allows a trainer who has the required section permission', () => {
    const user = {
      role: 'trainer',
      granularPermissions: { settings: { actions: { feeSettings: true } } },
    };

    expect(activate(user, 'feeSettings')).toBe(true);
  });

  it('rejects a trainer without the required section permission (403)', () => {
    const user = {
      role: 'trainer',
      granularPermissions: { settings: { actions: { feeSettings: false } } },
    };

    expect(() => activate(user, 'feeSettings')).toThrow(ForbiddenException);
  });

  it('rejects a trainer with no granularPermissions at all', () => {
    const user = { role: 'trainer' };

    expect(() => activate(user, 'notificationSettings')).toThrow(
      ForbiddenException,
    );
  });

  it('allows a trainer reaching feeSettings via Payments page access (documented bypass)', () => {
    const user = {
      role: 'trainer',
      pagePermissions: { payments: true },
      granularPermissions: { settings: { actions: { feeSettings: false } } },
    };

    expect(activate(user, 'feeSettings')).toBe(true);
  });

  it('does NOT let Payments page access bypass invoiceSettings (bypass is feeSettings-only)', () => {
    const user = {
      role: 'trainer',
      pagePermissions: { payments: true },
      granularPermissions: { settings: { actions: { invoiceSettings: false } } },
    };

    expect(() => activate(user, 'invoiceSettings')).toThrow(
      ForbiddenException,
    );
  });

  it('passes through when the route requires no settings action', () => {
    expect(activate({ role: 'trainer' }, undefined)).toBe(true);
  });
});
