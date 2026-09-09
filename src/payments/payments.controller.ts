import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';
import { PaymentActionGuard } from '../auth/payment-permission.guard';
import { RequirePaymentAction } from '../auth/payment-permission.decorator';
import { GranularPermissionsMap } from '../auth/student-permission-keys';

import { SetupStudentFeeDto } from './dto/setup-student-fee.dto';

import { CollectStudentPaymentDto } from './dto/collect-student-payment.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import {
  redactPaymentForUser,
  redactPaymentListForUser,
} from './payment-field-redaction.util';

interface RequestWithUser {
  user?: {
    role: string;
    granularPermissions?: GranularPermissionsMap;
  };
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /*
   * PUBLIC STUDENT PAYMENT PAGE
   * NO LOGIN / NO JWT
   */

  @Get('public/student/:studentId')
  getPublicStudentPayment(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService.getPublicStudentPayment(studentId);
  }

  @Post('public/student/:studentId/proof')
  submitPaymentProof(
    @Param('studentId')
    studentId: string,

    @Body()
    submitPaymentProofDto: SubmitPaymentProofDto,
  ) {
    return this.paymentsService.submitPaymentProof(
      studentId,
      submitPaymentProofDto,
    );
  }

  /*
   * ADMIN UPI PAYMENT SETTINGS
   */

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('upiSettings')
  @Get('settings')
  getPaymentSettings() {
    return this.paymentsService.getPublicPaymentSettings();
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('upiSettings')
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
    return this.paymentsService.updatePublicPaymentSettings(body);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard)
  @RequirePage('payments')
  @Put('due-date')
  setFeeDueDate(
    @Body('feeDueDate')
    feeDueDate: string,
  ) {
    return this.paymentsService.setFeeDueDate(feeDueDate);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard)
  @RequirePage('payments')
  @Get('due-date')
  getFeeDueDate() {
    return this.paymentsService.getFeeDueDate();
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('feeSetupIndividual', 'assignNextFee')
  @Put('student/:studentId/fee-setup')
  setupStudentFee(
    @Param('studentId')
    studentId: string,

    @Body()
    setupStudentFeeDto: SetupStudentFeeDto,
  ) {
    return this.paymentsService.setupStudentFee(studentId, setupStudentFeeDto);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('feeSetupCommon')
  @Put('fee-setup/common')
  setupCommonFee(
    @Body()
    setupStudentFeeDto: SetupStudentFeeDto,
  ) {
    return this.paymentsService.setupCommonFee(setupStudentFeeDto);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('feeSetupCourseWise')
  @Put('fee-setup/course/:course')
  setupCourseWiseFee(
    @Param('course')
    course: string,

    @Body()
    setupStudentFeeDto: SetupStudentFeeDto,
  ) {
    return this.paymentsService.setupCourseWiseFee(course, setupStudentFeeDto);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('editFee')
  @Put('student/:studentId/fee-edit')
  editStudentFee(
    @Param('studentId') studentId: string,
    @Body() setupStudentFeeDto: SetupStudentFeeDto,
  ) {
    return this.paymentsService.editStudentFee(studentId, setupStudentFeeDto);
  }
  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('collectPayment', 'addPartPayment')
  @Get('proofs/pending')
  getPendingPaymentProofs() {
    return this.paymentsService.getPendingPaymentProofs();
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('collectPayment', 'addPartPayment')
  @Get('student/:studentId/proof')
  getStudentPaymentProof(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService.getStudentPaymentProof(studentId);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('collectPayment', 'addPartPayment')
  @Post('student/:studentId/proof/:proofId/dismiss')
  dismissPaymentProof(
    @Param('studentId')
    studentId: string,

    @Param('proofId')
    proofId: string,
  ) {
    return this.paymentsService.dismissPaymentProof(studentId, proofId);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('collectPayment', 'addPartPayment')
  @Post('student/:studentId/collect')
  collectStudentPayment(
    @Param('studentId')
    studentId: string,

    @Body()
    collectStudentPaymentDto: CollectStudentPaymentDto,
  ) {
    return this.paymentsService.collectStudentPayment(
      studentId,
      collectStudentPaymentDto,
    );
  }

  /*
   * Clears only transaction history.
   * Fee totals and installment status are preserved.
   */
  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('clearPaymentHistory')
  @Delete('student/:studentId/history')
  clearStudentPaymentHistory(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService.clearStudentPaymentHistory(studentId);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, PaymentActionGuard)
  @RequirePage('payments')
  @RequirePaymentAction('reverseResetFeeSetup')
  @Post('student/:studentId/reset-fee')
  resetStudentFee(
    @Param('studentId')
    studentId: string,
  ) {
    return this.paymentsService.resetStudentFee(studentId);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard)
  @RequirePage('payments')
  @Get()
  async getPayments(
    @Req()
    request: RequestWithUser,
  ) {
    const payments = await this.paymentsService.getPayments();

    return redactPaymentListForUser(
      payments.map(
        (payment) => payment.toObject() as unknown as Record<string, unknown>,
      ),
      request.user,
    );
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard)
  @RequirePage('payments')
  @Get(':id')
  async getPaymentById(
    @Param('id')
    id: string,

    @Req()
    request: RequestWithUser,
  ) {
    const payment = await this.paymentsService.getPaymentById(id);

    return redactPaymentForUser(
      payment.toObject() as unknown as Record<string, unknown>,
      request.user,
    );
  }
}
