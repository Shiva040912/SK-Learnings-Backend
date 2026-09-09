// Single source of truth for the Invoices page's granular permission shape:
// Actions (what a user can DO) and Fields (what invoice/student data they
// can see — one flag per field, controlling every place that field is
// displayed: the receipt-board rows and the opened invoice document alike).
//
// This list was built by inspecting the actual Invoice.jsx/InvoiceDocument
// implementation, not guessed. There is no Create/Edit/Delete-single/Send
// action because none exists — invoices are generated automatically from
// the Payments flow (InvoiceService.createFeeSetupInvoice/
// createPaymentReceiptInvoice), never authored on this page. "search",
// "filter" and "printInvoice" have no dedicated backend route (they operate
// on data already fetched via GET /invoices) — enforcement for those three
// is frontend-only (hides the control), same precedent as Payments'/
// Notifications' "search"/"filter" actions.
export const INVOICE_ACTION_KEYS = [
  'search',
  'filter',
  'viewInvoice',
  'downloadInvoice',
  'printInvoice',
  'clearInvoices',
] as const;

export type InvoiceActionKey = (typeof INVOICE_ACTION_KEYS)[number];
export type InvoiceActionsMap = Record<InvoiceActionKey, boolean>;

// One entry per actual data field shown on the Invoices page (receipt board
// + opened invoice document). Business/letterhead fields (owner name, GST,
// address, QR, footer, terms) are deliberately excluded — those are the
// organisation's own configuration (already gated on the Settings page's
// Invoice Settings section), not per-student/per-transaction data that
// needs redacting from a viewing user.
export const INVOICE_FIELD_KEYS = [
  'studentName',
  'rollNo',
  'course',
  'batch',
  'parentName',
  'phone',
  'invoiceNumber',
  'invoiceDate',
  'dueDate',
  'totalAmount',
  'paidAmount',
  'pendingAmount',
  'paymentStatus',
  'paymentMethod',
] as const;

export type InvoiceFieldKey = (typeof INVOICE_FIELD_KEYS)[number];
export type InvoiceFieldsMap = Record<InvoiceFieldKey, boolean>;

export interface InvoicePermissions {
  actions: InvoiceActionsMap;
  fields: InvoiceFieldsMap;
}

// Actions are deny-by-default — an Admin has to explicitly grant each one.
export const createDefaultInvoiceActions = (): InvoiceActionsMap =>
  INVOICE_ACTION_KEYS.reduce((actions, key) => {
    actions[key] = false;
    return actions;
  }, {} as InvoiceActionsMap);

// Fields are visible-by-default — turning Invoices page access on shows the
// full board/document exactly as before, until an Admin deliberately hides
// a field.
export const createDefaultInvoiceFields = (): InvoiceFieldsMap =>
  INVOICE_FIELD_KEYS.reduce((fields, key) => {
    fields[key] = true;
    return fields;
  }, {} as InvoiceFieldsMap);

export const createDefaultInvoicePermissions = (): InvoicePermissions => ({
  actions: createDefaultInvoiceActions(),
  fields: createDefaultInvoiceFields(),
});

// Deliberately reads each key via property access instead of object-
// spreading wholesale — see the identical note on normalizeStudentActions
// in student-permission-keys.ts (Mongoose (sub)documents expose schema
// fields as getters that a spread does not pick up).
export const normalizeInvoiceActions = (
  actions?: Partial<InvoiceActionsMap> | null,
): InvoiceActionsMap => {
  const merged = createDefaultInvoiceActions();

  for (const key of INVOICE_ACTION_KEYS) {
    const value = actions?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  return merged;
};

export const normalizeInvoiceFields = (
  fields?: Partial<InvoiceFieldsMap> | null,
): InvoiceFieldsMap => {
  const merged = createDefaultInvoiceFields();

  for (const key of INVOICE_FIELD_KEYS) {
    const value = fields?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  return merged;
};

export interface InvoicePermissionsInput {
  actions?: Partial<InvoiceActionsMap> | null;
  fields?: Partial<InvoiceFieldsMap> | null;
}

export const normalizeInvoicePermissions = (
  permissions?: InvoicePermissionsInput | null,
): InvoicePermissions => ({
  actions: normalizeInvoiceActions(permissions?.actions),
  fields: normalizeInvoiceFields(permissions?.fields),
});

export const hasInvoiceAction = (
  permissions: InvoicePermissions | undefined | null,
  action: InvoiceActionKey,
): boolean => {
  if (!permissions) return false;

  return permissions.actions?.[action] === true;
};
