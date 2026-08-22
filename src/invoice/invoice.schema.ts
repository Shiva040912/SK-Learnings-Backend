import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Types,
} from 'mongoose';

export type InvoiceDocument =
  HydratedDocument<Invoice>;

export type InvoiceCounterDocument =
  HydratedDocument<InvoiceCounter>;

@Schema({
  _id: false,
})
export class InvoiceStudentSnapshot {
  @Prop({
    required: true,
    trim: true,
  })
  studentName!: string;

  @Prop({
    required: true,
    trim: true,
  })
  rollNo!: string;

  @Prop({
    required: true,
    trim: true,
  })
  course!: string;

  @Prop({
    default: '',
    trim: true,
  })
  batch!: string;

  @Prop({
    required: true,
    trim: true,
  })
  parentName!: string;

  @Prop({
    required: true,
    trim: true,
  })
  phone!: string;

  @Prop({
    default: '',
    trim: true,
  })
  alternatePhone!: string;

  @Prop({
    default: '',
    trim: true,
  })
  email!: string;

  @Prop({
    default: '',
    trim: true,
  })
  idproof!: string;

  @Prop({
    default: '',
    trim: true,
  })
  schoolName!: string;

  @Prop({
    default: '',
    trim: true,
  })
  address!: string;
}

export const InvoiceStudentSnapshotSchema =
  SchemaFactory.createForClass(
    InvoiceStudentSnapshot,
  );

@Schema({
  _id: false,
})
export class InvoiceBusinessSnapshot {
  @Prop({
    default: 'THE SK LEARNINGS',
    trim: true,
  })
  businessName!: string;

  @Prop({
    default:
      'Private Educational Services',
    trim: true,
  })
  tagline!: string;

  @Prop({
    default:
      'MEDICAL / ENGINEERING / FOUNDATIONS / JUNIOR IAS',
    trim: true,
  })
  motto!: string;

  @Prop({
    default: '',
    trim: true,
  })
  ownerName!: string;

  @Prop({
    default: '',
    trim: true,
  })
  gstNumber!: string;

  @Prop({
    default: '',
    trim: true,
  })
  address!: string;

  @Prop({
    default: '',
    trim: true,
  })
  invoicePrefix!: string;

  @Prop({
    default: '',
    trim: true,
  })
  invoiceSuffix!: string;

  @Prop({
    default: '',
  })
  qrCode!: string;

  @Prop({
    default: '',
    trim: true,
  })
  invoiceFooter!: string;

  @Prop({
    default: '',
    trim: true,
  })
  invoiceTerms!: string;
}

export const InvoiceBusinessSnapshotSchema =
  SchemaFactory.createForClass(
    InvoiceBusinessSnapshot,
  );

@Schema({
  _id: false,
})
export class InvoiceInstallmentSnapshot {
  @Prop({
    required: true,
    min: 1,
  })
  installmentNumber!: number;

  @Prop({
    required: true,
    min: 0,
  })
  amount!: number;

  @Prop({
    enum: ['unpaid', 'paid'],
    default: 'unpaid',
  })
  status!: 'unpaid' | 'paid';

  @Prop({
    type: Date,
    default: null,
  })
  paidAt?: Date;
}

export const InvoiceInstallmentSnapshotSchema =
  SchemaFactory.createForClass(
    InvoiceInstallmentSnapshot,
  );

@Schema({
  _id: false,
})
export class InvoicePaymentHistorySnapshot {
  @Prop({
    required: true,
    min: 0,
  })
  amount!: number;

  @Prop({
    type: Date,
    required: true,
  })
  paymentDate!: Date;

  @Prop({
    enum: [
      'cash',
      'bank',
      'upi',
      'qr',
    ],
    required: true,
  })
  paymentMethod!:
    | 'cash'
    | 'bank'
    | 'upi'
    | 'qr';

  @Prop({
    default: null,
    min: 1,
  })
  installmentNumber?: number;
}

export const InvoicePaymentHistorySnapshotSchema =
  SchemaFactory.createForClass(
    InvoicePaymentHistorySnapshot,
  );

@Schema({
  _id: false,
})
export class InvoiceFeeSnapshot {
  @Prop({
    required: true,
    min: 0,
  })
  totalFee!: number;

  @Prop({
    enum: [
      'monthly',
      'partial',
      'yearly',
    ],
    required: true,
  })
  feeType!:
    | 'monthly'
    | 'partial'
    | 'yearly';

  @Prop({
    default: null,
  })
  selectedMonths?: number;

  @Prop({
    default: 0,
    min: 0,
  })
  monthlyAmount!: number;

  /*
   * Kept only for old invoice compatibility.
   * New Partial payment flow does not use a minimum amount rule.
   */
  @Prop({
    default: 0,
    min: 0,
  })
  minimumPartialAmount!: number;

  @Prop({
    type: Date,
    default: null,
  })
  feeStartingDate?: Date;

  @Prop({
    type: Date,
    default: null,
  })
  feeEndingDate?: Date;

  @Prop({
    default: 0,
    min: 0,
  })
  currentPayableAmount!: number;

  @Prop({
    default: null,
    min: 1,
  })
  currentInstallmentNumber?: number;

  @Prop({
    type: [
      InvoiceInstallmentSnapshotSchema,
    ],
    default: [],
  })
  monthlyInstallments!:
    InvoiceInstallmentSnapshot[];

  @Prop({
    type: [
      InvoicePaymentHistorySnapshotSchema,
    ],
    default: [],
  })
  paymentHistory!:
    InvoicePaymentHistorySnapshot[];
}

export const InvoiceFeeSnapshotSchema =
  SchemaFactory.createForClass(
    InvoiceFeeSnapshot,
  );

@Schema({
  timestamps: true,
})
export class Invoice {
  @Prop({
    required: true,
    unique: true,
    trim: true,
    index: true,
  })
  invoiceNumber!: string;

  @Prop({
    enum: [
      'fee_setup',
      'payment_receipt',
    ],
    required: true,
    index: true,
  })
  invoiceType!:
    | 'fee_setup'
    | 'payment_receipt';

  @Prop({
    type: Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  })
  studentId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Payment',
    default: null,
    index: true,
  })
  paymentId?: Types.ObjectId;

  @Prop({
    type: InvoiceStudentSnapshotSchema,
    required: true,
  })
  student!: InvoiceStudentSnapshot;

  @Prop({
    type: InvoiceBusinessSnapshotSchema,
    required: true,
  })
  business!: InvoiceBusinessSnapshot;

  @Prop({
    type: InvoiceFeeSnapshotSchema,
    required: true,
  })
  fee!: InvoiceFeeSnapshot;

  @Prop({
    required: true,
    min: 0,
  })
  invoiceAmount!: number;

  @Prop({
    default: 0,
    min: 0,
  })
  paidAmount!: number;

  @Prop({
    default: 0,
    min: 0,
  })
  pendingAmount!: number;

  @Prop({
    enum: [
      'unpaid',
      'partial',
      'paid',
    ],
    default: 'unpaid',
  })
  paymentStatus!:
    | 'unpaid'
    | 'partial'
    | 'paid';

  @Prop({
    enum: [
      'cash',
      'bank',
      'upi',
      'qr',
    ],
    default: null,
  })
  paymentMethod?:
    | 'cash'
    | 'bank'
    | 'upi'
    | 'qr';

  @Prop({
    type: Date,
    default: null,
  })
  paymentDate?: Date;

  @Prop({
    type: Date,
    default: Date.now,
  })
  invoiceDate!: Date;

  @Prop({
    type: Date,
    default: null,
  })
  dueDate?: Date;

  @Prop({
    default: true,
  })
  isActive!: boolean;
}

export const InvoiceSchema =
  SchemaFactory.createForClass(
    Invoice,
  );

@Schema({
  timestamps: true,
})
export class InvoiceCounter {
  @Prop({
    required: true,
    unique: true,
    default: 'invoice',
  })
  name!: string;

  @Prop({
    default: 0,
    min: 0,
  })
  sequence!: number;
}

export const InvoiceCounterSchema =
  SchemaFactory.createForClass(
    InvoiceCounter,
  );