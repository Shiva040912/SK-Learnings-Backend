import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Student,
  StudentDocument,
} from '../student/students.schema';

import {
  Payment,
  PaymentDocument,
} from '../payments/payments.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,

    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  async getDashboardSummary() {
    const now = new Date();

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );

    const startOfNextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
    );

    const [
      totalStudents,
      monthlyCollectionResult,
      pendingResult,
      courseWiseStudents,
      students,
    ] = await Promise.all([
      this.studentModel.countDocuments(),

      this.paymentModel.aggregate([
        {
          $match: {
            paymentDate: {
              $gte: startOfMonth,
              $lt: startOfNextMonth,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$amount',
            },
          },
        },
      ]),

      this.studentModel.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: '$pendingAmount',
            },
          },
        },
      ]),

      this.studentModel.aggregate([
        {
          $group: {
            _id: '$course',
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
      ]),

      this.studentModel
        .find()
        .select(
          '_id studentName rollNo course paymentStatus pendingAmount',
        )
        .sort({
          updatedAt: -1,
        })
        .lean(),
    ]);

    return {
      totalStudents,

      thisMonthCollection:
        monthlyCollectionResult[0]?.total || 0,

      totalPending:
        pendingResult[0]?.total || 0,

      courseWiseStudents:
        courseWiseStudents.map((item) => ({
          course: item._id || 'Unknown',
          count: item.count,
        })),

      studentDetails: students.map(
        (student) => ({
          studentId: student._id,
          studentName: student.studentName,
          rollNo: student.rollNo,
          course: student.course,
          status:
            student.paymentStatus ||
            'unpaid',
          pendingAmount:
            student.pendingAmount || 0,
        }),
      ),
    };
  }
}