import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { SetupStudentFeeDto } from './dto/setup-student-fee.dto';

import { CollectStudentPaymentDto } from './dto/collect-student-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService:
      PaymentsService,
  ) {}

  /*
   * PUBLIC STUDENT PAYMENT PAGE
   * NO LOGIN / NO JWT
   */

  @Get('public/student/:studentId')
  getPublicStudentPayment(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService
      .getPublicStudentPayment(
        studentId,
      );
  }

  /*
   * ADMIN UPI PAYMENT SETTINGS
   */

  @UseGuards(JwtAuthGuard)
  @Get('settings')
  getPaymentSettings() {
    return this.paymentsService
      .getPublicPaymentSettings();
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings')
  updatePaymentSettings(
    @Body()
    body: {
      upiId?: string;
      receiverName?: string;
      paymentPhone?: string;
      upiQrImage?: string;
    },
  ) {
    return this.paymentsService
      .updatePublicPaymentSettings(
        body,
      );
  }

  @UseGuards(JwtAuthGuard)
  @Put('due-date')
  setFeeDueDate(
    @Body('feeDueDate')
    feeDueDate: string,
  ) {
    return this.paymentsService
      .setFeeDueDate(
        feeDueDate,
      );
  }

  @UseGuards(JwtAuthGuard)
  @Get('due-date')
  getFeeDueDate() {
    return this.paymentsService
      .getFeeDueDate();
  }

  @UseGuards(JwtAuthGuard)
  @Put(
    'student/:studentId/fee-setup',
  )
  setupStudentFee(
    @Param('studentId')
    studentId: string,

    @Body()
    setupStudentFeeDto:
      SetupStudentFeeDto,
  ) {
    return this.paymentsService
      .setupStudentFee(
        studentId,
        setupStudentFeeDto,
      );
  }

  @UseGuards(JwtAuthGuard)
  @Put('fee-setup/common')
  setupCommonFee(
    @Body()
    setupStudentFeeDto:
      SetupStudentFeeDto,
  ) {
    return this.paymentsService
      .setupCommonFee(
        setupStudentFeeDto,
      );
  }

  @UseGuards(JwtAuthGuard)
  @Put(
    'fee-setup/course/:course',
  )
  setupCourseWiseFee(
    @Param('course')
    course: string,

    @Body()
    setupStudentFeeDto:
      SetupStudentFeeDto,
  ) {
    return this.paymentsService
      .setupCourseWiseFee(
        course,
        setupStudentFeeDto,
      );
  }

  @UseGuards(JwtAuthGuard)
  @Post(
    'student/:studentId/collect',
  )
  collectStudentPayment(
    @Param('studentId')
    studentId: string,

    @Body()
    collectStudentPaymentDto:
      CollectStudentPaymentDto,
  ) {
    return this.paymentsService
      .collectStudentPayment(
        studentId,
        collectStudentPaymentDto,
      );
  }

  /*
   * Clears only transaction history.
   * Fee totals and installment status are preserved.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(
    'student/:studentId/history',
  )
  clearStudentPaymentHistory(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService
      .clearStudentPaymentHistory(
        studentId,
      );
  }

  @UseGuards(JwtAuthGuard)
  @Post(
    'student/:studentId/reset-fee',
  )
  resetStudentFee(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService
      .resetStudentFee(
        studentId,
      );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getPayments() {
    return this.paymentsService
      .getPayments();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getPaymentById(
    @Param('id')
    id: string,
  ) {
    return this.paymentsService
      .getPaymentById(
        id,
      );
  }
}
