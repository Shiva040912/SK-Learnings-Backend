import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import {
  createDefaultStudentActions,
  createDefaultStudentFields,
} from '../auth/student-permission-keys';
import {
  createDefaultPaymentActions,
  createDefaultPaymentFields,
  createDefaultPaymentUpiFields,
} from '../auth/payment-permission-keys';
import {
  createDefaultNotificationActions,
  createDefaultNotificationFields,
} from '../auth/notification-permission-keys';

export type UserDocument = HydratedDocument<User>;

@Schema({
  _id: false,
})
export class StudentActions {
  @Prop({ default: false })
  view!: boolean;

  @Prop({ default: false })
  add!: boolean;

  @Prop({ default: false })
  edit!: boolean;

  @Prop({ default: false })
  delete!: boolean;

  @Prop({ default: false })
  bulkUpload!: boolean;

  @Prop({ default: false })
  addCourse!: boolean;

  @Prop({ default: false })
  deleteCourse!: boolean;

  @Prop({ default: false })
  addBatch!: boolean;

  @Prop({ default: false })
  deleteBatch!: boolean;
}

export const StudentActionsSchema =
  SchemaFactory.createForClass(StudentActions);

// One flag per actual student data field — controls that field everywhere
// it is displayed (table column and profile popup alike). There is no
// separate "columns" vs "details" schema: a field is configured once.
@Schema({
  _id: false,
})
export class StudentFields {
  @Prop({ default: true })
  studentName!: boolean;

  @Prop({ default: true })
  rollNo!: boolean;

  @Prop({ default: true })
  parentName!: boolean;

  @Prop({ default: true })
  dateOfBirth!: boolean;

  @Prop({ default: true })
  gender!: boolean;

  @Prop({ default: true })
  phone!: boolean;

  @Prop({ default: true })
  alternatePhone!: boolean;

  @Prop({ default: true })
  email!: boolean;

  @Prop({ default: true })
  course!: boolean;

  @Prop({ default: true })
  idproof!: boolean;

  @Prop({ default: true })
  batch!: boolean;

  @Prop({ default: true })
  schoolName!: boolean;

  @Prop({ default: true })
  address!: boolean;
}

export const StudentFieldsSchema = SchemaFactory.createForClass(StudentFields);

@Schema({
  _id: false,
})
export class StudentPermissions {
  @Prop({
    type: StudentActionsSchema,
    default: () => createDefaultStudentActions(),
  })
  actions!: StudentActions;

  @Prop({
    type: StudentFieldsSchema,
    default: () => createDefaultStudentFields(),
  })
  fields!: StudentFields;
}

export const StudentPermissionsSchema =
  SchemaFactory.createForClass(StudentPermissions);

@Schema({
  _id: false,
})
export class PaymentActions {
  @Prop({ default: false })
  search!: boolean;

  @Prop({ default: false })
  filter!: boolean;

  @Prop({ default: false })
  upiSettings!: boolean;

  @Prop({ default: false })
  feeSetupIndividual!: boolean;

  @Prop({ default: false })
  feeSetupCommon!: boolean;

  @Prop({ default: false })
  feeSetupCourseWise!: boolean;

  @Prop({ default: false })
  collectPayment!: boolean;

  @Prop({ default: false })
  reverseResetFeeSetup!: boolean;

  @Prop({ default: false })
  viewStudentPaymentDetails!: boolean;

  @Prop({ default: false })
  editFee!: boolean;

  @Prop({ default: false })
  addPartPayment!: boolean;

  @Prop({ default: false })
  viewPaymentHistory!: boolean;

  @Prop({ default: false })
  clearPaymentHistory!: boolean;

  @Prop({ default: false })
  assignNextFee!: boolean;
}

export const PaymentActionsSchema =
  SchemaFactory.createForClass(PaymentActions);

// One flag per actual payment/student data field — controls that field
// everywhere it is displayed (table column, details modal and history modal
// alike). There is no separate "columns" vs "details" schema: a field is
// configured once. Monthly Installment fields are deliberately absent — that
// flow is dead in the live UI.
@Schema({
  _id: false,
})
export class PaymentFields {
  @Prop({ default: true })
  studentName!: boolean;

  @Prop({ default: true })
  rollNo!: boolean;

  @Prop({ default: true })
  course!: boolean;

  @Prop({ default: true })
  batch!: boolean;

  @Prop({ default: true })
  totalFee!: boolean;

  @Prop({ default: true })
  feeType!: boolean;

  @Prop({ default: true })
  feeStartingDate!: boolean;

  @Prop({ default: true })
  feeEndingDate!: boolean;

  @Prop({ default: true })
  feeSetupCompleted!: boolean;

  @Prop({ default: true })
  paidAmount!: boolean;

  @Prop({ default: true })
  pendingAmount!: boolean;

  @Prop({ default: true })
  paymentStatus!: boolean;

  @Prop({ default: true })
  paymentMethod!: boolean;

  @Prop({ default: true })
  paymentDate!: boolean;
}

export const PaymentFieldsSchema = SchemaFactory.createForClass(PaymentFields);

// Global UPI receiver configuration fields — not per-student data, kept
// separate from PaymentFields.
@Schema({
  _id: false,
})
export class PaymentUpiFields {
  @Prop({ default: true })
  upiId!: boolean;

  @Prop({ default: true })
  receiverName!: boolean;

  @Prop({ default: true })
  paymentPhone!: boolean;

  @Prop({ default: true })
  upiQrImage!: boolean;
}

export const PaymentUpiFieldsSchema =
  SchemaFactory.createForClass(PaymentUpiFields);

@Schema({
  _id: false,
})
export class PaymentPermissions {
  @Prop({
    type: PaymentActionsSchema,
    default: () => createDefaultPaymentActions(),
  })
  actions!: PaymentActions;

  @Prop({
    type: PaymentFieldsSchema,
    default: () => createDefaultPaymentFields(),
  })
  fields!: PaymentFields;

  @Prop({
    type: PaymentUpiFieldsSchema,
    default: () => createDefaultPaymentUpiFields(),
  })
  upiSettings!: PaymentUpiFields;
}

export const PaymentPermissionsSchema =
  SchemaFactory.createForClass(PaymentPermissions);

@Schema({
  _id: false,
})
export class NotificationActions {
  @Prop({ default: false })
  search!: boolean;

  @Prop({ default: false })
  filter!: boolean;

  @Prop({ default: false })
  refresh!: boolean;

  @Prop({ default: false })
  sendNotification!: boolean;

  @Prop({ default: false })
  sendToAll!: boolean;

  @Prop({ default: false })
  sendIndividualSelected!: boolean;

  @Prop({ default: false })
  sendReminder!: boolean;

  @Prop({ default: false })
  notificationPreferences!: boolean;
}

export const NotificationActionsSchema =
  SchemaFactory.createForClass(NotificationActions);

// One flag per actual notification data field — controls that field
// everywhere it is displayed (table column, row subtext and the
// preferences menu alike). There is no separate "columns" vs "details"
// schema: a field is configured once.
@Schema({
  _id: false,
})
export class NotificationFields {
  @Prop({ default: true })
  studentName!: boolean;

  @Prop({ default: true })
  rollNo!: boolean;

  @Prop({ default: true })
  course!: boolean;

  @Prop({ default: true })
  batch!: boolean;

  @Prop({ default: true })
  pendingAmount!: boolean;

  @Prop({ default: true })
  paidAmount!: boolean;

  @Prop({ default: true })
  feeEndingDate!: boolean;

  @Prop({ default: true })
  alertType!: boolean;

  @Prop({ default: true })
  reminderCount!: boolean;

  @Prop({ default: true })
  lastReminderSentAt!: boolean;

  @Prop({ default: true })
  nextReminderDate!: boolean;

  @Prop({ default: true })
  paymentStatus!: boolean;

  @Prop({ default: true })
  muteAll!: boolean;

  @Prop({ default: true })
  muteReminder!: boolean;
}

export const NotificationFieldsSchema =
  SchemaFactory.createForClass(NotificationFields);

@Schema({
  _id: false,
})
export class NotificationPermissions {
  @Prop({
    type: NotificationActionsSchema,
    default: () => createDefaultNotificationActions(),
  })
  actions!: NotificationActions;

  @Prop({
    type: NotificationFieldsSchema,
    default: () => createDefaultNotificationFields(),
  })
  fields!: NotificationFields;
}

export const NotificationPermissionsSchema = SchemaFactory.createForClass(
  NotificationPermissions,
);

// Granular (per-page, beyond-just-access) permissions. Students, Payments
// and Notifications are populated — Invoices gets its own props here in a
// later phase, each independent of the others.
@Schema({
  _id: false,
})
export class GranularPermissions {
  @Prop({
    type: StudentPermissionsSchema,
    default: () => ({}),
  })
  students!: StudentPermissions;

  @Prop({
    type: PaymentPermissionsSchema,
    default: () => ({}),
  })
  payments!: PaymentPermissions;

  @Prop({
    type: NotificationPermissionsSchema,
    default: () => ({}),
  })
  notifications!: NotificationPermissions;
}

export const GranularPermissionsSchema =
  SchemaFactory.createForClass(GranularPermissions);

@Schema({
  _id: false,
})
export class PagePermissions {
  @Prop({ default: false })
  dashboard!: boolean;

  @Prop({ default: false })
  students!: boolean;

  @Prop({ default: false })
  payments!: boolean;

  @Prop({ default: false })
  invoices!: boolean;

  @Prop({ default: false })
  notifications!: boolean;

  @Prop({ default: false })
  users!: boolean;

  @Prop({ default: false })
  settings!: boolean;
}

export const PagePermissionsSchema =
  SchemaFactory.createForClass(PagePermissions);

@Schema({
  timestamps: true,
})
export class User {
  @Prop({
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({
    trim: true,
    default: '',
  })
  phone?: string;

  @Prop({
    trim: true,
    default: '',
  })
  profileImage?: string;

  @Prop({
    required: true,
  })
  password!: string;

  @Prop({
    enum: ['admin', 'trainer'],
    default: 'trainer',
  })
  role!: 'admin' | 'trainer';

  @Prop({
    default: true,
  })
  isActive!: boolean;

  @Prop({
    type: PagePermissionsSchema,
    default: () => ({}),
  })
  pagePermissions!: PagePermissions;

  @Prop({
    type: GranularPermissionsSchema,
    default: () => ({}),
  })
  granularPermissions!: GranularPermissions;
}

export const UserSchema = SchemaFactory.createForClass(User);
