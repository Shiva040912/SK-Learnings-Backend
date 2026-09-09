// Single source of truth for the Students page's granular permission shape:
// Actions (what a user can DO) and Fields (what student data they can see —
// one flag per field, controlling every place that field is displayed:
// table column and profile popup alike). There is deliberately no separate
// "columns" vs "details" concept — a field is visible everywhere or nowhere
// for a given user, never configured twice.
//
// This file also composes GranularPermissionsMap, the per-page granular
// permissions container — each page's own shape (Students here, Payments in
// payment-permission-keys.ts, Notifications in notification-permission-keys.ts,
// future pages later) stays independent, but the container and its
// normalize/default helpers live in one place so every consumer (login,
// JwtStrategy, the redaction utils, UsersService) reads through a single
// normalizeGranularPermissions/createDefaultGranularPermissions pair.
import {
  PaymentPermissions,
  PaymentPermissionsInput,
  createDefaultPaymentPermissions,
  normalizePaymentPermissions,
} from './payment-permission-keys';
import {
  NotificationPermissions,
  NotificationPermissionsInput,
  createDefaultNotificationPermissions,
  normalizeNotificationPermissions,
} from './notification-permission-keys';

export const STUDENT_ACTION_KEYS = [
  'view',
  'add',
  'edit',
  'delete',
  'bulkUpload',
  'addCourse',
  'deleteCourse',
  'addBatch',
  'deleteBatch',
] as const;

export type StudentActionKey = (typeof STUDENT_ACTION_KEYS)[number];
export type StudentActionsMap = Record<StudentActionKey, boolean>;

// One entry per actual student data field (backend/frontend field name),
// never a UI construct — S.No and the row Actions buttons are table
// controls, not data, and are never gated here.
export const STUDENT_FIELD_KEYS = [
  'studentName',
  'rollNo',
  'parentName',
  'dateOfBirth',
  'gender',
  'phone',
  'alternatePhone',
  'email',
  'course',
  'idproof',
  'batch',
  'schoolName',
  'address',
] as const;

export type StudentFieldKey = (typeof STUDENT_FIELD_KEYS)[number];
export type StudentFieldsMap = Record<StudentFieldKey, boolean>;

export interface StudentPermissions {
  actions: StudentActionsMap;
  fields: StudentFieldsMap;
}

export interface GranularPermissionsMap {
  students: StudentPermissions;
  payments: PaymentPermissions;
  notifications: NotificationPermissions;
}

// Actions are deny-by-default — an Admin has to explicitly grant each one.
export const createDefaultStudentActions = (): StudentActionsMap =>
  STUDENT_ACTION_KEYS.reduce((actions, key) => {
    actions[key] = false;
    return actions;
  }, {} as StudentActionsMap);

// Fields are visible-by-default — turning Students page access on shows the
// full table/popup exactly as before, until an Admin deliberately hides a
// field.
export const createDefaultStudentFields = (): StudentFieldsMap =>
  STUDENT_FIELD_KEYS.reduce((fields, key) => {
    fields[key] = true;
    return fields;
  }, {} as StudentFieldsMap);

export const createDefaultStudentPermissions = (): StudentPermissions => ({
  actions: createDefaultStudentActions(),
  fields: createDefaultStudentFields(),
});

export const createDefaultGranularPermissions = (): GranularPermissionsMap => ({
  students: createDefaultStudentPermissions(),
  payments: createDefaultPaymentPermissions(),
  notifications: createDefaultNotificationPermissions(),
});

// Bulk Upload is never an independent permission — it is always exactly
// what Add Student is. This is the one place that truth is computed, so a
// stored/incoming `bulkUpload: true` next to `add: false` can never survive
// a save, and any reader that trusts this helper (instead of the raw
// `actions.bulkUpload` field) can never be fooled by a crafted payload.
//
// Deliberately reads each key via property access (`actions?.[key]`)
// instead of object-spreading `actions` wholesale. `actions` is sometimes a
// live Mongoose (sub)document (e.g. `user.granularPermissions.students`
// straight off a non-`.lean()` query, as in AuthService.login) rather than
// a plain object — Mongoose exposes schema fields as getters on the
// document's prototype, which a spread's own-enumerable-property
// enumeration does NOT pick up (it only copies Mongoose's internal
// bookkeeping props like `_doc`/`$__`). Property access, unlike spread,
// still goes through those getters correctly for either shape.
export const normalizeStudentActions = (
  actions?: Partial<StudentActionsMap> | null,
): StudentActionsMap => {
  const merged = createDefaultStudentActions();

  for (const key of STUDENT_ACTION_KEYS) {
    const value = actions?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  merged.bulkUpload = merged.add;

  return merged;
};

export const normalizeStudentFields = (
  fields?: Partial<StudentFieldsMap> | null,
): StudentFieldsMap => {
  const merged = createDefaultStudentFields();

  for (const key of STUDENT_FIELD_KEYS) {
    const value = fields?.[key];

    if (value !== undefined) {
      merged[key] = value === true;
    }
  }

  return merged;
};

export interface StudentPermissionsInput {
  actions?: Partial<StudentActionsMap> | null;
  fields?: Partial<StudentFieldsMap> | null;
}

export const normalizeStudentPermissions = (
  permissions?: StudentPermissionsInput | null,
): StudentPermissions => ({
  actions: normalizeStudentActions(permissions?.actions),
  fields: normalizeStudentFields(permissions?.fields),
});

export const normalizeGranularPermissions = (
  permissions?: {
    students?: StudentPermissionsInput | null;
    payments?: PaymentPermissionsInput | null;
    notifications?: NotificationPermissionsInput | null;
  } | null,
): GranularPermissionsMap => ({
  students: normalizeStudentPermissions(permissions?.students),
  payments: normalizePaymentPermissions(permissions?.payments),
  notifications: normalizeNotificationPermissions(permissions?.notifications),
});

// True only if the action is granted AND (for bulkUpload specifically) Add
// Student is granted — callers never need to know about the dependency.
export const hasStudentAction = (
  permissions: StudentPermissions | undefined | null,
  action: StudentActionKey,
): boolean => {
  if (!permissions) return false;

  if (action === 'bulkUpload') {
    return permissions.actions?.add === true;
  }

  return permissions.actions?.[action] === true;
};
