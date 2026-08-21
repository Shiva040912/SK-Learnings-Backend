import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';

@Controller('payments/public')
export class PaymentsPublicController {
  constructor(
    private readonly paymentsService:
      PaymentsService,
  ) {}

  
  @Get(':studentId')
  getPublicStudentPayment(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService
      .getPublicStudentPayment(
        studentId,
      );
  }
}