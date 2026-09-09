import {
  GranularPermissionsMap,
  normalizeGranularPermissions,
} from '../auth/student-permission-keys';

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

// Applies the Invoices page's own Fields permissions to one Invoice
// document — same "one flag controls this field everywhere" rule as the
// Payments/Notifications redaction utils, applied to both the top-level
// invoice fields and the nested student/fee snapshots the receipt board and
// InvoiceDocument actually render.
export function redactInvoiceForUser<T extends Record<string, unknown>>(
  invoice: T,
  user: RequestUser | undefined,
): T {
  if (!user || user.role === 'admin') {
    return invoice;
  }

  const permissions = normalizeGranularPermissions(
    user.granularPermissions,
  ).invoices;

  const fields = permissions.fields;
  const plain = toPlainObject(invoice);

  if (fields.invoiceNumber !== true) {
    delete plain.invoiceNumber;
  }

  if (fields.invoiceDate !== true) {
    delete plain.invoiceDate;
  }

  // dueDate/paymentDate occupy the same "when" slot in the UI depending on
  // invoice type (fee_setup shows Due Date, payment_receipt shows Payment
  // Date) — one field permission covers both.
  if (fields.dueDate !== true) {
    delete plain.dueDate;
    delete plain.paymentDate;
  }

  if (fields.paymentStatus !== true) {
    delete plain.paymentStatus;
  }

  if (fields.paymentMethod !== true) {
    delete plain.paymentMethod;
  }

  if (fields.paidAmount !== true) {
    delete plain.paidAmount;
  }

  if (fields.pendingAmount !== true) {
    delete plain.pendingAmount;
  }

  // invoiceAmount is the document's headline "Total"/"Amount Payable"/
  // "Payment Received" figure — gated by the "totalAmount" field, along
  // with the matching nested fee snapshot figures and the per-payment
  // breakdown that also discloses amounts.
  if (fields.totalAmount !== true) {
    delete plain.invoiceAmount;

    if (plain.fee && typeof plain.fee === 'object') {
      const fee = { ...(plain.fee as Record<string, unknown>) };
      delete fee.totalFee;
      delete fee.currentPayableAmount;
      plain.fee = fee;
    }
  }

  if (fields.paidAmount !== true || fields.paymentMethod !== true) {
    // Part Payment History / Monthly Installment rows disclose amount and
    // paymentMethod per row — hidden if either underlying field is hidden,
    // since a redacted row would otherwise leak the other value.
    if (plain.fee && typeof plain.fee === 'object') {
      const fee = { ...(plain.fee as Record<string, unknown>) };
      delete fee.paymentHistory;
      delete fee.monthlyInstallments;
      plain.fee = fee;
    }
  }

  if (plain.student && typeof plain.student === 'object') {
    const student = { ...(plain.student as Record<string, unknown>) };

    if (fields.studentName !== true) delete student.studentName;
    if (fields.rollNo !== true) delete student.rollNo;
    if (fields.course !== true) delete student.course;
    if (fields.batch !== true) delete student.batch;
    if (fields.parentName !== true) delete student.parentName;
    if (fields.phone !== true) delete student.phone;

    plain.student = student;
  }

  return plain as T;
}

export function redactInvoiceListForUser<T extends Record<string, unknown>>(
  invoices: T[],
  user: RequestUser | undefined,
): T[] {
  return invoices.map((invoice) => redactInvoiceForUser(invoice, user));
}
