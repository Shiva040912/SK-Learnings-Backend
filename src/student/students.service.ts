import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Student, StudentDocument } from './students.schema';

import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
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
    const student = await this.studentModel.findByIdAndDelete(id);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return {
      message: 'Student deleted successfully',
    };
  }

 
}
