import {
  GranularPermissionsMap,
  STUDENT_FIELD_KEYS,
  normalizeStudentPermissions,
} from '../auth/student-permission-keys';

interface RequestUser {
  role: string;
  granularPermissions?: GranularPermissionsMap;
  pagePermissions?: { payments?: boolean };
}

// Redacts using the Students page's own Fields permissions. The Payments
// page also fetches this same list to build its fee-management table, but
// it now has its own independent Fields permissions and its own redaction
// (redactStudentForPaymentsUser in payments/payment-field-redaction.util.ts)
// — StudentsController.findAll picks whichever applies based on the
// requesting page, so this function is never applied to a Payments-page
// request.
export function redactStudentForUser<T extends Record<string, unknown>>(
  student: T,
  user: RequestUser | undefined,
): T {
  if (!user || user.role === 'admin') {
    return student;
  }

  const permissions = normalizeStudentPermissions(
    user.granularPermissions?.students,
  );

  const plain: Record<string, unknown> =
    typeof (student as { toObject?: () => Record<string, unknown> })
      .toObject === 'function'
      ? (
          student as unknown as { toObject: () => Record<string, unknown> }
        ).toObject()
      : { ...student };

  // One flag per field controls that field everywhere it's displayed —
  // there's nothing else to check here.
  for (const field of STUDENT_FIELD_KEYS) {
    if (permissions.fields[field] !== true) {
      delete plain[field];
    }
  }

  return plain as T;
}

export function redactStudentListForUser<T extends Record<string, unknown>>(
  students: T[],
  user: RequestUser | undefined,
): T[] {
  return students.map((student) => redactStudentForUser(student, user));
}
