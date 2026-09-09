import { SetMetadata } from '@nestjs/common';

import { PaymentActionKey } from './payment-permission-keys';

export const REQUIRED_PAYMENT_ACTIONS_KEY = 'requiredPaymentActions';

// Any ONE of the listed actions is sufficient (OR'd), mirroring RequirePage's
// multi-page OR semantics. This is needed because a couple of Payments
// routes are the shared implementation behind more than one live Payments
// action:
//  - PUT .../fee-setup powers both "Fee Setup — Individual" (first-time
//    setup) and "Assign Next Fee / Start New Cycle" (re-setup after the
//    student's current fee is fully paid) — same endpoint, same handler,
//    distinguished only by the student's current state, not the route.
//  - POST .../collect powers both "Collect Payment" (from the table/status
//    modal) and "Add Part Payment" (from the student details modal).
// Always pair with @RequirePage('payments') — this decorator only narrows
// access further, it never grants page access.
export const RequirePaymentAction = (...actions: PaymentActionKey[]) =>
  SetMetadata(REQUIRED_PAYMENT_ACTIONS_KEY, actions);
