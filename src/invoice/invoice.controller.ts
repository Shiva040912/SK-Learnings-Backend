import {
  Controller,
  Delete,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Response } from 'express';

import { InvoiceService } from './invoice.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';
import { InvoiceActionGuard } from '../auth/invoice-permission.guard';
import { RequireInvoiceAction } from '../auth/invoice-permission.decorator';
import { GranularPermissionsMap } from '../auth/student-permission-keys';
import {
  redactInvoiceForUser,
  redactInvoiceListForUser,
} from './invoice-field-redaction.util';

interface RequestWithUser {
  user?: {
    role: string;
    granularPermissions?: GranularPermissionsMap;
  };
}

@Controller('invoices')
@UseGuards(JwtAuthGuard, PagePermissionGuard, InvoiceActionGuard)
@RequirePage('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  async getInvoices(@Req() request: RequestWithUser) {
    const invoices = await this.invoiceService.getInvoices();

    return redactInvoiceListForUser(
      invoices.map(
        (invoice) => invoice.toObject() as unknown as Record<string, unknown>,
      ),
      request.user,
    );
  }

  @Get('student/:studentId')
  async getStudentInvoices(
    @Param('studentId')
    studentId: string,

    @Req()
    request: RequestWithUser,
  ) {
    const invoices = await this.invoiceService.getStudentInvoices(studentId);

    return redactInvoiceListForUser(
      invoices.map(
        (invoice) => invoice.toObject() as unknown as Record<string, unknown>,
      ),
      request.user,
    );
  }

  @Get('number/:invoiceNumber')
  async getInvoiceByNumber(
    @Param('invoiceNumber')
    invoiceNumber: string,

    @Req()
    request: RequestWithUser,
  ) {
    const invoice =
      await this.invoiceService.getInvoiceByNumber(invoiceNumber);

    return redactInvoiceForUser(
      invoice.toObject() as unknown as Record<string, unknown>,
      request.user,
    );
  }

  @RequireInvoiceAction('downloadInvoice')
  @Get(':id/pdf')
  async downloadInvoicePdf(
    @Param('id')
    id: string,

    @Res()
    response: Response,
  ) {
    const invoice = await this.invoiceService.getInvoiceById(id);

    const pdfBuffer =
      await this.invoiceService.generateInvoicePdfByDocument(invoice);

    response.set({
      'Content-Type': 'application/pdf',

      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,

      'Content-Length': pdfBuffer.length,
    });

    response.end(pdfBuffer);
  }

  @Get(':id')
  async getInvoiceById(
    @Param('id')
    id: string,

    @Req()
    request: RequestWithUser,
  ) {
    const invoice = await this.invoiceService.getInvoiceById(id);

    return redactInvoiceForUser(
      invoice.toObject() as unknown as Record<string, unknown>,
      request.user,
    );
  }

  @RequireInvoiceAction('clearInvoices')
  @Delete('clear')
  clearAllInvoices() {
    return this.invoiceService.clearAllInvoices();
  }
}
