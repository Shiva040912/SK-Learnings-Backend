import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ timestamps: true })
export class Student {
  @Prop({ required: true, trim: true })
  studentName!: string;

  @Prop({ required: true, trim: true })
  parentName!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ trim: true })
  alternatePhone?: string;

  @Prop({ trim: true })
  email?: string;

  @Prop({ required: true, trim: true })
  course!: string;

  @Prop({ required: true, trim: true })
  idproof!: string;

  @Prop({ trim: true })
  batch?: string;

  @Prop({ trim: true })
  schoolName?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ required: true, min: 0 })
  totalFee!: number;

  @Prop({ default: 0, min: 0 })
  paidAmount!: number;

  @Prop({ required: true, min: 0 })
  pendingAmount!: number;

  @Prop({
    enum: ['pending', 'partial', 'paid'],
    default: 'pending',
  })
  paymentStatus!: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const StudentSchema = SchemaFactory.createForClass(Student);