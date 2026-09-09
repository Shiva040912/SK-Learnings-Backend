import { SetMetadata } from '@nestjs/common';

import { InvoiceActionKey } from './invoice-permission-keys';

export const REQUIRED_INVOICE_ACTION_KEY = 'requiredInvoiceAction';

// Gates a route behind one Invoices-page granular action, e.g.
// @RequireInvoiceAction('downloadInvoice'). Always pair with
// @RequirePage('invoices') — this decorator only narrows access further, it
// never grants page access.
export const RequireInvoiceAction = (action: InvoiceActionKey) =>
  SetMetadata(REQUIRED_INVOICE_ACTION_KEY, action);
