import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Student, StudentDocument } from './students.schema';
import { Payment, PaymentDocument } from '../payments/payments.schema';
import {
  PaymentProof,
  PaymentProofDocument,
} from '../payments/payment-proof.schema';
import { Invoice, InvoiceDocument } from '../invoice/invoice.schema';

import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,

    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,

    @InjectModel(PaymentProof.name)
    private readonly paymentProofModel: Model<PaymentProofDocument>,

    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
  ) {}

  private normalizeParentName(parentName: string) {
    return parentName.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private async validateUniqueFields(
    data: {
      parentName?: string;
      rollNo?: string;
      phone?: string;
      alternatePhone?: string;
      email?: string;
      idproof?: string;
    },
    excludeStudentId?: string,
  ) {
    const excludeQuery = excludeStudentId
      ? {
          _id: {
            $ne: excludeStudentId,
          },
        }
      : {};

    if (data.rollNo) {
      const existingRollNo = await this.studentModel.findOne({
        ...excludeQuery,
        rollNo: data.rollNo.trim(),
      });

      if (existingRollNo) {
        throw new ConflictException('Roll number already exists');
      }
    }

    if (data.phone && data.parentName) {
      const existingStudents = await this.studentModel.find({
        ...excludeQuery,
        $or: [
          {
            phone: data.phone.trim(),
          },
          {
            alternatePhone: data.phone.trim(),
          },
        ],
      });

      const currentParent = this.normalizeParentName(data.parentName);

      const differentParent = existingStudents.find(
        (existingStudent) =>
          this.normalizeParentName(existingStudent.parentName) !==
          currentParent,
      );

      if (differentParent) {
        throw new ConflictException(
          'Phone number is already registered with another parent',
        );
      }
    }

    if (
      data.phone &&
      data.alternatePhone &&
      data.phone.trim() === data.alternatePhone.trim()
    ) {
      throw new ConflictException(
        'Phone number and alternative phone number cannot be the same',
      );
    }

    if (data.alternatePhone && data.parentName) {
      const existingStudents = await this.studentModel.find({
        ...excludeQuery,
        $or: [
          {
            phone: data.alternatePhone.trim(),
          },
          {
            alternatePhone: data.alternatePhone.trim(),
          },
        ],
      });

      const currentParent = this.normalizeParentName(data.parentName);

      const differentParent = existingStudents.find(
        (existingStudent) =>
          this.normalizeParentName(existingStudent.parentName) !==
          currentParent,
      );

      if (differentParent) {
        throw new ConflictException(
          'Alternative phone number is already registered with another parent',
        );
      }
    }

    if (data.email) {
      const existingEmail = await this.studentModel.findOne({
        ...excludeQuery,
        email: data.email.trim().toLowerCase(),
      });

      if (existingEmail) {
        throw new ConflictException('Email ID already exists');
      }
    }

    if (data.idproof) {
      const existingAadhaar = await this.studentModel.findOne({
        ...excludeQuery,
        idproof: data.idproof.trim(),
      });

      if (existingAadhaar) {
        throw new ConflictException('Aadhaar number already exists');
      }
    }
  }

  async create(createStudentDto: CreateStudentDto) {
    await this.validateUniqueFields({
      parentName: createStudentDto.parentName,

      rollNo: createStudentDto.rollNo,

      phone: createStudentDto.phone,

      alternatePhone: createStudentDto.alternatePhone,

      email: createStudentDto.email,

      idproof: createStudentDto.idproof,
    });

    const student = new this.studentModel({
      studentName: createStudentDto.studentName.trim(),

      rollNo: createStudentDto.rollNo.trim(),

      parentName: createStudentDto.parentName.trim().replace(/\s+/g, ' '),

      dateOfBirth: new Date(createStudentDto.dateOfBirth),

      gender: createStudentDto.gender,

      phone: createStudentDto.phone.trim(),

      alternatePhone: createStudentDto.alternatePhone?.trim() || undefined,

      email: createStudentDto.email?.trim().toLowerCase() || undefined,

      course: createStudentDto.course.trim(),

      idproof: createStudentDto.idproof.trim(),

      batch: createStudentDto.batch?.trim() || undefined,

      schoolName: createStudentDto.schoolName?.trim() || undefined,

      address: createStudentDto.address?.trim() || undefined,

      totalFee: 0,

      feeType: undefined,

      feeEndingDate: undefined,

      feeDueDay: undefined,

      feeDueDate: undefined,

      feeSetupCompleted: false,

      selectedMonths: undefined,

      monthlyAmount: 0,

      paidMonths: 0,

      paidAmount: 0,

      pendingAmount: 0,

      paymentStatus: 'unpaid',

      paymentMethod: undefined,

      isActive: true,
    });

    return student.save();
  }

  async findAll() {
    return this.studentModel.find().sort({
      createdAt: -1,
    });
  }

  async findOne(id: string) {
    const student = await this.studentModel.findById(id);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async update(id: string, updateStudentDto: UpdateStudentDto) {
    const student = await this.findOne(id);

    const {
      totalFee,
      feeType,
      feeEndingDate,
      feeSetupCompleted,
      selectedMonths,
      monthlyAmount,
      paidMonths,
      paidAmount,
      pendingAmount,
      paymentStatus,
      paymentMethod,
      ...studentData
    } = updateStudentDto;

    const finalParentName = studentData.parentName ?? student.parentName;

    const finalPhone = studentData.phone ?? student.phone;

    const finalAlternatePhone =
      studentData.alternatePhone ?? student.alternatePhone;

    await this.validateUniqueFields(
      {
        parentName: finalParentName,

        rollNo: studentData.rollNo,

        phone: finalPhone,

        alternatePhone: finalAlternatePhone,

        email: studentData.email,

        idproof: studentData.idproof,
      },
      id,
    );

    if (studentData.studentName !== undefined) {
      student.studentName = studentData.studentName.trim();
    }

    if (studentData.rollNo !== undefined) {
      student.rollNo = studentData.rollNo.trim();
    }

    if (studentData.parentName !== undefined) {
      student.parentName = studentData.parentName.trim().replace(/\s+/g, ' ');
    }

    if (studentData.dateOfBirth !== undefined) {
      student.dateOfBirth = new Date(studentData.dateOfBirth);
    }

    if (studentData.gender !== undefined) {
      student.gender = studentData.gender;
    }

    if (studentData.phone !== undefined) {
      student.phone = studentData.phone.trim();
    }

    if (studentData.alternatePhone !== undefined) {
      student.alternatePhone = studentData.alternatePhone.trim() || undefined;
    }

    if (studentData.email !== undefined) {
      student.email = studentData.email.trim().toLowerCase() || undefined;
    }

    if (studentData.course !== undefined) {
      student.course = studentData.course.trim();
    }

    if (studentData.idproof !== undefined) {
      student.idproof = studentData.idproof.trim();
    }

    if (studentData.batch !== undefined) {
      student.batch = studentData.batch.trim() || undefined;
    }

    if (studentData.schoolName !== undefined) {
      student.schoolName = studentData.schoolName.trim() || undefined;
    }

    if (studentData.address !== undefined) {
      student.address = studentData.address.trim() || undefined;
    }

    if (studentData.isActive !== undefined) {
      student.isActive = studentData.isActive;
    }

    return student.save();
  }

  async remove(id: string) {
    const student = await this.studentModel.findById(id);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Payment, PaymentProof and Invoice are the only collections that
    // reference a student by studentId (monthlyInstallments/fee-cycle data
    // live embedded on the Student document itself and are removed with
    // it, so they can never be orphaned). Checked with .exists() — an
    // indexed existence check, not a full fetch — and evaluated BEFORE any
    // delete is attempted, so a blocked deletion never touches the
    // database and can never leave a partially-deleted state.
    //
    // studentId is cast to ObjectId explicitly rather than left as the raw
    // route-param string: these three schemas declare studentId's type as
    // `Types.ObjectId` (the driver's id class), which Mongoose's SchemaType
    // resolution does not treat as equivalent to `Schema.Types.ObjectId` —
    // the path ends up typed Mixed, so Mongoose does not auto-cast a plain
    // string query value the way it would for a properly-typed ObjectId
    // path, and a string filter would silently match nothing.
    const studentObjectId = new Types.ObjectId(id);

    const [hasPayment, hasPaymentProof, hasInvoice] = await Promise.all([
      this.paymentModel.exists({ studentId: studentObjectId }),
      this.paymentProofModel.exists({ studentId: studentObjectId }),
      this.invoiceModel.exists({ studentId: studentObjectId }),
    ]);

    if (hasPayment || hasPaymentProof || hasInvoice) {
      throw new ConflictException(
        'This student cannot be deleted because payment, payment-proof, or invoice records are linked to them. Financial records must be preserved.',
      );
    }

    // NOTE: without a multi-document transaction, a financial record
    // created for this student in the brief window between the checks
    // above and this delete would not be caught — MongoDB has no
    // foreign-key constraint to fall back on. This is the same
    // check-then-act limitation any non-transactional guard has; it does
    // not risk a partially-deleted state, since the delete below only ever
    // touches the Student document itself.
    const deletedStudent = await this.studentModel.findOneAndDelete({
      _id: id,
    });

    if (!deletedStudent) {
      throw new NotFoundException('Student not found');
    }

    return {
      message: 'Student deleted successfully',
    };
  }

  async trackPaymentLinkClick(studentId: string) {
    const student = await this.studentModel.findById(studentId);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    student.paymentPageVisitedCount =
      Number(student.paymentPageVisitedCount || 0) + 1;

    student.lastPaymentPageVisitedAt = new Date();

    await student.save();

    return {
      success: true,
      paymentPageVisitedCount: student.paymentPageVisitedCount,

      lastPaymentPageVisitedAt: student.lastPaymentPageVisitedAt,
    };
  }
}
