import {
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

  async create(createStudentDto: CreateStudentDto) {
    const student = new this.studentModel({
      ...createStudentDto,
      paidAmount: 0,
      pendingAmount: createStudentDto.totalFee,
      paymentStatus: 'pending',
      isActive: true,
    });

    return student.save();
  }

  async findAll() {
    return this.studentModel
      .find()
      .sort({ createdAt: -1 });
  }

  async findOne(id: string) {
    const student = await this.studentModel.findById(id);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async update(
    id: string,
    updateStudentDto: UpdateStudentDto,
  ) {
    const student = await this.findOne(id);

    Object.assign(student, updateStudentDto);

    if (updateStudentDto.totalFee !== undefined) {
      student.pendingAmount = Math.max(
        student.totalFee - student.paidAmount,
        0,
      );

      if (student.pendingAmount === 0) {
        student.paymentStatus = 'paid';
      } else if (student.paidAmount > 0) {
        student.paymentStatus = 'partial';
      } else {
        student.paymentStatus = 'pending';
      }
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