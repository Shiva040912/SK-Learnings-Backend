import {
  Controller,
  Delete,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';

import type {
  Response,
} from 'express';

import { InvoiceService } from './invoice.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoiceController {
  constructor(
    private readonly invoiceService:
      InvoiceService,
  ) {}

  @Get()
  getInvoices() {
    return this.invoiceService.getInvoices();
  }

  @Get('student/:studentId')
  getStudentInvoices(
    @Param('studentId')
    studentId: string,
  ) {
    return this.invoiceService.getStudentInvoices(
      studentId,
    );
  }

  @Get('number/:invoiceNumber')
  getInvoiceByNumber(
    @Param('invoiceNumber')
    invoiceNumber: string,
  ) {
    return this.invoiceService.getInvoiceByNumber(
      invoiceNumber,
    );
  }

  @Get(':id/pdf')
  async downloadInvoicePdf(
    @Param('id')
    id: string,

    @Res()
    response:
      Response,
  ) {
    const invoice =
      await this.invoiceService.getInvoiceById(
        id,
      );

    const pdfBuffer =
      await this.invoiceService.generateInvoicePdfByDocument(
        invoice,
      );

    response.set({
      'Content-Type':
        'application/pdf',

      'Content-Disposition':
        `inline; filename="${invoice.invoiceNumber}.pdf"`,

      'Content-Length':
        pdfBuffer.length,
    });

    response.end(
      pdfBuffer,
    );
  }

  @Get(':id')
  getInvoiceById(
    @Param('id')
    id: string,
  ) {
    return this.invoiceService.getInvoiceById(
      id,
    );
  }

  @Delete('clear')
  clearAllInvoices() {
    return this.invoiceService.clearAllInvoices();
  }
}