import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { PaymentsService } from './payments.service';

@Controller('payments/public')
export class PaymentsPublicController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Same unauthenticated lookup as PaymentsController's public/student/:id
  // route — same limit for consistency.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':studentId')
  getPublicStudentPayment(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService.getPublicStudentPayment(studentId);
  }
}
