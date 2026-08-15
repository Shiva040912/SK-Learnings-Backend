import {
  Body,
  Controller,
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
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService:
      PaymentsService,
  ) {}

  @Put('due-date')
  setFeeDueDate(
    @Body('feeDueDate')
    feeDueDate: string,
  ) {
    return this.paymentsService.setFeeDueDate(
      feeDueDate,
    );
  }

  @Get('due-date')
  getFeeDueDate() {
    return this.paymentsService.getFeeDueDate();
  }

  @Put('student/:studentId/fee-setup')
  setupStudentFee(
    @Param('studentId')
    studentId: string,

    @Body()
    setupStudentFeeDto:
      SetupStudentFeeDto,
  ) {
    return this.paymentsService.setupStudentFee(
      studentId,
      setupStudentFeeDto,
    );
  }

  @Post('student/:studentId/collect')
  collectStudentPayment(
    @Param('studentId')
    studentId: string,

    @Body()
    collectStudentPaymentDto:
      CollectStudentPaymentDto,
  ) {
    return this.paymentsService.collectStudentPayment(
      studentId,
      collectStudentPaymentDto,
    );
  }

  @Post('student/:studentId/reset-fee')
  resetStudentFee(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService.resetStudentFee(
      studentId,
    );
  }

  @Get()
  getPayments() {
    return this.paymentsService.getPayments();
  }

  @Get(':id')
  getPaymentById(
    @Param('id')
    id: string,
  ) {
    return this.paymentsService.getPaymentById(
      id,
    );
  }
}