import {
  GranularPermissionsMap,
  normalizeGranularPermissions,
} from '../auth/student-permission-keys';
import {
  PAYMENT_FIELD_KEYS,
  hasFeeDetailsAccess,
  resolveEffectivePaymentFields,
} from '../auth/payment-permission-keys';

interface RequestUser {
  role: string;
  granularPermissions?: GranularPermissionsMap;
}

function toPlainObject<T extends Record<string, unknown>>(record: T) {
  return typeof (record as { toObject?: () => Record<string, unknown> })
    .toObject === 'function'
    ? (
        record as unknown as { toObject: () => Record<string, unknown> }
      ).toObject()
    : { ...record };
}

// Applies the Payments page's own Fields permissions to a Student document.
// Used for the subset of Student schema fields the Payments page displays
// (studentName, rollNo, course, batch and the fee/payment-status fields) —
// completely independent of the Students page's own Fields permissions.
export function redactStudentForPaymentsUser<T extends Record<string, unknown>>(
  student: T,
  user: RequestUser | undefined,
): T {
  if (!user || user.role === 'admin') {
    return student;
  }

  const permissions = normalizeGranularPermissions(
    user.granularPermissions,
  ).payments;

  // "Fee Details" is a master switch on top of the individual field flags —
  // this is the single place that master-AND-individual logic is applied,
  // so every fee/financial field below (and anything piggybacking on one,
  // like feeDueDay/feeDueDate on feeEndingDate) is automatically covered.
  const effectiveFields = resolveEffectivePaymentFields(permissions.fields);

  const plain = toPlainObject(student);

  for (const field of PAYMENT_FIELD_KEYS) {
    if (effectiveFields[field] !== true && field in plain) {
      delete plain[field];
    }
  }

  // feeDueDay/feeDueDate replaced feeEndingDate as the source of the
  // student's due-date info — they ride on the same "feeEndingDate" Fields
  // permission flag (now labeled "Due Date") rather than needing their own.
  if (effectiveFields.feeEndingDate !== true) {
    delete plain.feeDueDay;
    delete plain.feeDueDate;
  }

  return plain as T;
}

export function redactStudentListForPaymentsUser<
  T extends Record<string, unknown>,
>(students: T[], user: RequestUser | undefined): T[] {
  return students.map((student) => redactStudentForPaymentsUser(student, user));
}

// Applies the Payments page's Fields permissions to a Payment (transaction)
// record — the only PAYMENT_FIELD_KEYS entries that live on this schema are
// paymentMethod and paymentDate. `createdAt` is stripped alongside
// paymentDate because the frontend history list falls back to it
// (`record.paymentDate || record.createdAt`) for the exact same "when was
// this paid" display — leaving it in would let the fallback defeat the
// paymentDate field toggle.
export function redactPaymentForUser<T extends Record<string, unknown>>(
  payment: T,
  user: RequestUser | undefined,
): T {
  if (!user || user.role === 'admin') {
    return payment;
  }

  const permissions = normalizeGranularPermissions(
    user.granularPermissions,
  ).payments;

  const plain = toPlainObject(payment);

  if (permissions.fields.paymentMethod !== true) {
    delete plain.paymentMethod;

    // screenshotImage/paymentProofId ride on the paymentMethod flag rather
    // than getting their own — same reasoning as feeDueDay/feeDueDate riding
    // on feeEndingDate above: both describe "how this specific payment was
    // made", and the screenshot is at least as sensitive as the method.
    delete plain.screenshotImage;
    delete plain.paymentProofId;
  }

  if (permissions.fields.paymentDate !== true) {
    delete plain.paymentDate;
    delete plain.createdAt;
  }

  // Transaction amount has no dedicated field toggle of its own — it is
  // purely gated by the Fee Details master switch (see FEE_DETAIL_FIELD_KEYS
  // for why: it's a fee/financial figure, not per-field-controllable data).
  if (!hasFeeDetailsAccess(permissions)) {
    delete plain.amount;
  }

  return plain as T;
}

export function redactPaymentListForUser<T extends Record<string, unknown>>(
  payments: T[],
  user: RequestUser | undefined,
): T[] {
  return payments.map((payment) => redactPaymentForUser(payment, user));
}

// PaymentProof responses (the pending-proofs list and the single-proof
// admin popup) carry the student's claimed amount — also purely Fee
// Details-gated, same reasoning as Payment.amount above. The screenshot
// itself is left alone: it is proof/evidence content, not a fee/financial
// figure, so it stays governed by its own existing (paymentMethod-linked)
// gating wherever that already applies.
export function redactPaymentProofForUser<T extends Record<string, unknown>>(
  proof: T,
  user: RequestUser | undefined,
): T {
  if (!user || user.role === 'admin') {
    return proof;
  }

  const permissions = normalizeGranularPermissions(
    user.granularPermissions,
  ).payments;

  if (hasFeeDetailsAccess(permissions)) {
    return proof;
  }

  const plain = toPlainObject(proof);
  delete plain.amountClaimed;

  return plain as T;
}

export function redactPaymentProofListForUser<
  T extends Record<string, unknown>,
>(proofs: T[], user: RequestUser | undefined): T[] {
  return proofs.map((proof) => redactPaymentProofForUser(proof, user));
}

// Dashboard summary financial redaction. The dashboard has no granular
// permission section of its own (only page access) and financial totals
// there aren't per-student fields anyway, so it defers to the same global
// "Fee Details" master switch used everywhere else fee/financial data is
// shown, instead of inventing a separate dashboard permission. Strips every
// company-wide money total and every per-student financial field; counts
// (totalStudents, courseWiseStudents) and non-financial identity fields on
// studentDetails carry no fee information and are left untouched.
export interface DashboardSummary {
  totalStudents: number;
  thisMonthCollection: number;
  totalPending: number;
  courseWiseStudents: Array<{ course: string; count: number }>;
  studentDetails: Array<{
    studentId: unknown;
    studentName: string;
    rollNo: string;
    course: string;
    status: string;
    pendingAmount: number;
  }>;
}

export function redactDashboardSummaryForUser(
  summary: DashboardSummary,
  user: RequestUser | undefined,
): DashboardSummary {
  if (!user || user.role === 'admin') {
    return summary;
  }

  const permissions = normalizeGranularPermissions(
    user.granularPermissions,
  ).payments;

  if (hasFeeDetailsAccess(permissions)) {
    return summary;
  }

  const redacted: Record<string, unknown> = { ...summary };

  delete redacted.thisMonthCollection;
  delete redacted.totalPending;

  redacted.studentDetails = summary.studentDetails.map((student) => {
    const plainStudent: Record<string, unknown> = { ...student };

    delete plainStudent.status;
    delete plainStudent.pendingAmount;

    return plainStudent;
  });

  return redacted as unknown as DashboardSummary;
}
