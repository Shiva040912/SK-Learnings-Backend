// Single source of truth for the Payments page's granular permission shape:
// Actions (what a user can DO), Fields (what payment/student data they can
// see — one flag per field, controlling every place that field is displayed:
// table column and details/history modals alike), and UPI Settings (the
// global receiver configuration fields, kept separate from per-student
// Fields since they are not per-student data). There is deliberately no
// separate "columns" vs "details" concept for Fields — a field is visible
// everywhere or nowhere for a given user, never configured twice.
export const PAYMENT_ACTION_KEYS = [
  'search',
  'filter',
  'upiSettings',
  'feeSetupIndividual',
  'feeSetupCommon',
  'feeSetupCourseWise',
  'collectPayment',
  'reverseResetFeeSetup',
  'viewStudentPaymentDetails',
  'editFee',
  'addPartPayment',
  'viewPaymentHistory',
  'clearPaymentHistory',
  'assignNextFee',
] as const;

export type PaymentActionKey = (typeof PAYMENT_ACTION_KEYS)[number];
export type PaymentActionsMap = Record<PaymentActionKey, boolean>;

// One entry per actual payment/student data field shown on the Payments
// page. The Monthly Installment fields (selectedMonths, monthlyAmount,
// monthlyInstallments, paidMonths) are deliberately excluded — that flow is
// dead in the live UI (Fee Type only ever offers partial/yearly), so it gets
// no permission surface.
export const PAYMENT_FIELD_KEYS = [
  'studentName',
  'rollNo',
  'course',
  'batch',
  'feeDetails',
  'totalFee',
  'feeType',
  'feeStartingDate',
  'feeEndingDate',
  'feeSetupCompleted',
  'paidAmount',
  'pendingAmount',
  'paymentStatus',
  'paymentMethod',
  'paymentDate',
] as const;

export type PaymentFieldKey = (typeof PAYMENT_FIELD_KEYS)[number];
export type PaymentFieldsMap = Record<PaymentFieldKey, boolean>;

// The subset of fields that are genuinely fee/financial information —
// gated by the "Fee Details" master switch (see resolveEffectivePaymentFields
// below) on top of their own individual flag. studentName/rollNo/course/
// batch/paymentStatus/paymentMethod/paymentDate are NOT fee/financial
// amounts or configuration, so they stay independently controlled and are
// deliberately excluded here. feeSetupCompleted is ALSO deliberately
// excluded even though it lives under "Fee Setup" conceptually: it is a
// plain readiness flag (no amount/date disclosed), and the frontend uses
// its raw boolean value to decide whether Collect Payment, Reverse/Reset,
// Edit Fee, Assign Next Fee and View History are even reachable for a
// student — stripping it made every one of those go dark for any non-admin
// user with Fee Details off, regardless of their actual action permissions.
export const FEE_DETAIL_FIELD_KEYS: PaymentFieldKey[] = [
  'totalFee',
  'feeType',
  'feeStartingDate',
  'feeEndingDate',
  'paidAmount',
  'pendingAmount',
];

// Global UPI receiver configuration — not per-student data, so it is kept as
// its own list rather than folded into PAYMENT_FIELD_KEYS.
export const PAYMENT_UPI_FIELD_KEYS = [
  'upiId',
  'receiverName',
  'paymentPhone',
  'upiQrImage',
] as const;

export type PaymentUpiFieldKey = (typeof PAYMENT_UPI_FIELD_KEYS)[number];
export type PaymentUpiFieldsMap = Record<PaymentUpiFieldKey, boolean>;

export interface PaymentPermissions {
  actions: PaymentActionsMap;
  fields: PaymentFieldsMap;
  upiSettings: PaymentUpiFieldsMap;
}

// Actions are deny-by-default — an Admin has to explicitly grant each one.
export const createDefaultPaymentActions = (): PaymentActionsMap =>
  PAYMENT_ACTION_KEYS.reduce((actions, key) => {
    actions[key] = false;
    return actions;
  }, {} as PaymentActionsMap);

// Fields (and UPI settings fields) are visible-by-default — turning Payments
// page access on shows the full table/modals exactly as before, until an
// Admin deliberately hides a field.
export const createDefaultPaymentFields = (): PaymentFieldsMap =>
  PAYMENT_FIELD_KEYS.reduce((fields, key) => {
    fields[key] = true;
    return fields;
  }, {} as PaymentFieldsMap);

export const createDefaultPaymentUpiFields = (): PaymentUpiFieldsMap =>
  PAYMENT_UPI_FIELD_KEYS.reduce((fields, key) => {
    fields[key] = true;
    return fields;
  }, {} as PaymentUpiFieldsMap);

export const createDefaultPaymentPermissions = (): PaymentPermissions => ({
  actions: createDefaultPaymentActions(),
  fields: createDefaultPaymentFields(),
  upiSettings: createDefaultPaymentUpiFields(),
});

// Deliberately reads each key via property access (`actions?.[key]`) instead
// of object-spreading `actions` wholesale — see the identical note on
// normalizeStudentActions in student-permission-keys.ts. `actions` is
// sometimes a live Mongoose (sub)document (e.g. off a non-`.lean()` query in
// AuthService.login) rather than a plain object, and spread does not read
// Mongoose's getter-based schema fields.
export const normalizePaymentActions = (
  actions?: Partial<PaymentActionsMap> | null,
): PaymentActionsMap => {
  const merged = createDefaultPaymentActions();

  for (const key of PAYMENT_ACTION_KEYS) {
    const value = actions?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  return merged;
};

export const normalizePaymentFields = (
  fields?: Partial<PaymentFieldsMap> | null,
): PaymentFieldsMap => {
  const merged = createDefaultPaymentFields();

  for (const key of PAYMENT_FIELD_KEYS) {
    const value = fields?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  return merged;
};

export const normalizePaymentUpiFields = (
  upiSettings?: Partial<PaymentUpiFieldsMap> | null,
): PaymentUpiFieldsMap => {
  const merged = createDefaultPaymentUpiFields();

  for (const key of PAYMENT_UPI_FIELD_KEYS) {
    const value = upiSettings?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  return merged;
};

export interface PaymentPermissionsInput {
  actions?: Partial<PaymentActionsMap> | null;
  fields?: Partial<PaymentFieldsMap> | null;
  upiSettings?: Partial<PaymentUpiFieldsMap> | null;
}

export const normalizePaymentPermissions = (
  permissions?: PaymentPermissionsInput | null,
): PaymentPermissions => ({
  actions: normalizePaymentActions(permissions?.actions),
  fields: normalizePaymentFields(permissions?.fields),
  upiSettings: normalizePaymentUpiFields(permissions?.upiSettings),
});

export const hasPaymentAction = (
  permissions: PaymentPermissions | undefined | null,
  action: PaymentActionKey,
): boolean => {
  if (!permissions) return false;

  return permissions.actions?.[action] === true;
};

// "Fee Details" is a master financial-information visibility switch: when
// it is off, none of FEE_DETAIL_FIELD_KEYS may be shown regardless of their
// own individual flag (master AND individual, never OR). Every consumer
// that decides what fee/financial data to actually return or render should
// read fields through this instead of the raw stored map, so the master
// switch can never be bypassed by an individually-enabled field — this is
// the single reusable answer to "can this user see fee details on
// Payments?", reused by both the field-redaction util and anywhere else on
// the backend that returns a fee amount/date/config value.
export const resolveEffectivePaymentFields = (
  fields: PaymentFieldsMap,
): PaymentFieldsMap => {
  if (fields.feeDetails === true) {
    return fields;
  }

  const effective = { ...fields };

  for (const key of FEE_DETAIL_FIELD_KEYS) {
    effective[key] = false;
  }

  return effective;
};

export const hasFeeDetailsAccess = (
  permissions: PaymentPermissions | undefined | null,
): boolean => {
  if (!permissions) return false;

  return permissions.fields?.feeDetails === true;
};
