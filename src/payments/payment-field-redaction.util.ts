import {
  GranularPermissionsMap,
  normalizeGranularPermissions,
} from '../auth/student-permission-keys';
import { PAYMENT_FIELD_KEYS } from '../auth/payment-permission-keys';

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

  const plain = toPlainObject(student);

  for (const field of PAYMENT_FIELD_KEYS) {
    if (permissions.fields[field] !== true && field in plain) {
      delete plain[field];
    }
  }

  // feeDueDay/feeDueDate replaced feeEndingDate as the source of the
  // student's due-date info — they ride on the same "feeEndingDate" Fields
  // permission flag (now labeled "Due Date") rather than needing their own.
  if (permissions.fields.feeEndingDate !== true) {
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
  }

  if (permissions.fields.paymentDate !== true) {
    delete plain.paymentDate;
    delete plain.createdAt;
  }

  return plain as T;
}

export function redactPaymentListForUser<T extends Record<string, unknown>>(
  payments: T[],
  user: RequestUser | undefined,
): T[] {
  return payments.map((payment) => redactPaymentForUser(payment, user));
}
