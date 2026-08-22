import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

type WhatsappTextParameter = {
  type: 'text';
  text: string;
};

type WhatsappDocumentParameter = {
  type: 'document';
  document: {
    id: string;
    filename: string;
  };
};

type WhatsappBodyComponent = {
  type: 'body';
  parameters: WhatsappTextParameter[];
};

type WhatsappHeaderComponent = {
  type: 'header';
  parameters: WhatsappDocumentParameter[];
};

type WhatsappButtonComponent = {
  type: 'button';
  sub_type: 'url';
  index: '0';
  parameters: WhatsappTextParameter[];
};

type WhatsappComponent =
  | WhatsappBodyComponent
  | WhatsappHeaderComponent
  | WhatsappButtonComponent;

@Injectable()
export class WhatsappService {
  private readonly logger =
    new Logger(
      WhatsappService.name,
    );

  constructor(
    private readonly configService:
      ConfigService,
  ) {}

  private getConfig() {
    const accessToken =
      this.configService.get<string>(
        'WHATSAPP_ACCESS_TOKEN',
      );

    const phoneNumberId =
      this.configService.get<string>(
        'WHATSAPP_PHONE_NUMBER_ID',
      );

    const apiVersion =
      this.configService.get<string>(
        'WHATSAPP_API_VERSION',
      );

    if (
      !accessToken ||
      !phoneNumberId ||
      !apiVersion
    ) {
      throw new InternalServerErrorException(
        'WhatsApp configuration is missing',
      );
    }

    return {
      accessToken,
      phoneNumberId,
      apiVersion,
    };
  }

  private normalizePhone(
    phone: string,
  ) {
    const cleanedPhone =
      String(phone || '')
        .replace(/\D/g, '');

    if (!cleanedPhone) {
      throw new BadRequestException(
        'Phone number is required',
      );
    }

    if (
      cleanedPhone.length === 10
    ) {
      return `91${cleanedPhone}`;
    }

    if (
      cleanedPhone.length === 12 &&
      cleanedPhone.startsWith('91')
    ) {
      return cleanedPhone;
    }

    throw new BadRequestException(
      'Enter a valid Indian WhatsApp number',
    );
  }

  private formatAmount(
    value: number,
  ) {
    return Number(
      value || 0,
    ).toLocaleString(
      'en-IN',
      {
        maximumFractionDigits: 2,
      },
    );
  }

  private formatDate(
    value:
      | Date
      | string,
  ) {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return '-';
    }

    return date.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      },
    );
  }

  private formatFeeType(
    value: string,
  ) {
    const labels: Record<
      string,
      string
    > = {
      monthly:
        'Monthly',

      partial:
        'Partial',

      yearly:
        'Yearly',
    };

    return (
      labels[value] ||
      value ||
      '-'
    );
  }

  private formatPaymentMethod(
    value: string,
  ) {
    const labels: Record<
      string,
      string
    > = {
      cash:
        'Cash',

      bank:
        'Bank',

      upi:
        'UPI',

      qr:
        'QR',
    };

    return (
      labels[value] ||
      value ||
      '-'
    );
  }

  private validateBodyParameters(
    parameters: string[],
  ) {
    const hasEmptyValue =
      parameters.some(
        (value) =>
          value ===
            undefined ||
          value ===
            null ||
          String(
            value,
          ).trim() === '',
      );

    if (
      hasEmptyValue
    ) {
      throw new BadRequestException(
        'WhatsApp template contains an empty required parameter',
      );
    }
  }

  async uploadPdf(
    pdfBuffer: Buffer,
    filename: string,
  ) {
    const {
      accessToken,
      phoneNumberId,
      apiVersion,
    } = this.getConfig();

    if (
      !pdfBuffer ||
      pdfBuffer.length === 0
    ) {
      throw new BadRequestException(
        'PDF file is empty',
      );
    }

    const safeFilename =
      String(
        filename ||
          'document.pdf',
      )
        .trim()
        .replace(
          /[^a-zA-Z0-9._-]/g,
          '-',
        );

    const finalFilename =
      safeFilename
        .toLowerCase()
        .endsWith(
          '.pdf',
        )
        ? safeFilename
        : `${safeFilename}.pdf`;

    const formData =
      new FormData();

    formData.append(
      'messaging_product',
      'whatsapp',
    );

    formData.append(
      'type',
      'application/pdf',
    );

    const pdfBytes =
      new Uint8Array(
        pdfBuffer,
      );

    const blob =
      new Blob(
        [
          pdfBytes,
        ],
        {
          type:
            'application/pdf',
        },
      );

    formData.append(
      'file',
      blob,
      finalFilename,
    );

    this.logger.log(
      `Uploading WhatsApp PDF: ${finalFilename}`,
    );

    try {
      const response =
        await fetch(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
          {
            method:
              'POST',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },

            body:
              formData,
          },
        );

      const result: any =
        await response.json();

      if (
        !response.ok ||
        !result?.id
      ) {
        this.logger.error(
          `WhatsApp PDF upload error: ${JSON.stringify(
            result,
            null,
            2,
          )}`,
        );

        throw new BadRequestException(
          result?.error
            ?.error_data
            ?.details ||
            result?.error
              ?.message ||
            'Failed to upload PDF to WhatsApp',
        );
      }

      this.logger.log(
        `WhatsApp PDF uploaded successfully. Media ID: ${result.id}`,
      );

      return {
        mediaId:
          String(
            result.id,
          ),

        filename:
          finalFilename,
      };
    } catch (error) {
      if (
        error instanceof
        BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `WhatsApp PDF upload request failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );

      throw new InternalServerErrorException(
        'Unable to upload PDF to WhatsApp',
      );
    }
  }

  async sendTemplate(
    data: {
      phone: string;
      templateName: string;
      languageCode?: string;
      bodyParameters?: string[];
      mediaId?: string;
      documentFilename?: string;
      buttonUrlParameter?: string;
    },
  ) {
    const {
      accessToken,
      phoneNumberId,
      apiVersion,
    } = this.getConfig();

    const phone =
      this.normalizePhone(
        data.phone,
      );

    if (
      !data.templateName
        ?.trim()
    ) {
      throw new BadRequestException(
        'WhatsApp template name is required',
      );
    }

    const bodyParameters =
      data.bodyParameters ||
      [];

    this.validateBodyParameters(
      bodyParameters,
    );

    const components:
      WhatsappComponent[] = [];

    if (
      data.mediaId
    ) {
      components.push({
        type:
          'header',

        parameters: [
          {
            type:
              'document',

            document: {
              id:
                data.mediaId,

              filename:
                data.documentFilename ||
                'document.pdf',
            },
          },
        ],
      });
    }

    if (
      bodyParameters.length >
      0
    ) {
      components.push({
        type:
          'body',

        parameters:
          bodyParameters.map(
            (value) => ({
              type:
                'text',

              text:
                String(
                  value,
                ).trim(),
            }),
          ),
      });
    }

    if (
      data.buttonUrlParameter &&
      data.buttonUrlParameter.trim()
    ) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          {
            type: 'text',
            text:
              data.buttonUrlParameter.trim(),
          },
        ],
      });
    }

    const payload = {
      messaging_product:
        'whatsapp',

      recipient_type:
        'individual',

      to:
        phone,

      type:
        'template',

      template: {
        name:
          data.templateName.trim(),

        language: {
          code:
            data.languageCode ||
            'en',
        },

        ...(components.length >
        0
          ? {
              components,
            }
          : {}),
      },
    };

    this.logger.log(
      `Sending WhatsApp template: ${data.templateName}`,
    );

    this.logger.log(
      `WhatsApp recipient: ${phone}`,
    );

    this.logger.log(
      `WhatsApp body parameters: ${JSON.stringify(
        bodyParameters,
      )}`,
    );

    if (
      data.mediaId
    ) {
      this.logger.log(
        `WhatsApp document media ID: ${data.mediaId}`,
      );
    }

    if (
      data.buttonUrlParameter
    ) {
      this.logger.log(
        `WhatsApp URL button parameter: ${data.buttonUrlParameter}`,
      );
    }

    try {
      const response =
        await fetch(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
          {
            method:
              'POST',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      const result: any =
        await response.json();

      if (
        !response.ok
      ) {
        this.logger.error(
          `WhatsApp API error: ${JSON.stringify(
            result,
            null,
            2,
          )}`,
        );

        throw new BadRequestException(
          result?.error
            ?.error_data
            ?.details ||
            result?.error
              ?.message ||
            'Failed to send WhatsApp message',
        );
      }

      this.logger.log(
        `WhatsApp template ${data.templateName} sent successfully to ${phone}`,
      );

      return {
        success:
          true,

        message:
          'WhatsApp message sent successfully',

        templateName:
          data.templateName,

        phone,

        messageId:
          result?.messages?.[0]
            ?.id ||
          null,

        mediaId:
          data.mediaId ||
          null,

        data:
          result,
      };
    } catch (error) {
      if (
        error instanceof
        BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `WhatsApp request failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );

      throw new InternalServerErrorException(
        'Unable to connect to WhatsApp API',
      );
    }
  }

  async sendFeePaymentInvoice(
    data: {
      phone: string;
      parentName: string;
      studentName: string;
      studentId: string;
      totalFee: number;
      feeType: string;
      pendingAmount: number;
      feeEndingDate:
        Date | string;
      pdfBuffer: Buffer;
      invoiceNumber: string;
    },
  ) {
    if (
      !data.parentName
        ?.trim()
    ) {
      throw new BadRequestException(
        'Parent name is required for fee invoice',
      );
    }

    if (
      !data.studentName
        ?.trim()
    ) {
      throw new BadRequestException(
        'Student name is required for fee invoice',
      );
    }

    if (
      !data.studentId
        ?.trim()
    ) {
      throw new BadRequestException(
        'Student ID is required for Pay Now button',
      );
    }

    const {
      mediaId,
      filename,
    } =
      await this.uploadPdf(
        data.pdfBuffer,
        `${data.invoiceNumber}.pdf`,
      );

    return this.sendTemplate({
      phone:
        data.phone,

      templateName:
        'fee_payment_invoice',

      languageCode:
        'en',

      mediaId,

      documentFilename:
        filename,

      /*
       * Meta template URL:
       * https://sk-learning-frontend.vercel.app/pay-fees/{{1}}
       *
       * Only the dynamic {{1}} value must be sent here.
       */
      buttonUrlParameter:
        data.studentId.trim(),

      bodyParameters: [
        data.parentName.trim(),

        data.studentName.trim(),

        this.formatAmount(
          data.totalFee,
        ),

        this.formatFeeType(
          data.feeType,
        ),

        this.formatAmount(
          data.pendingAmount,
        ),

        this.formatDate(
          data.feeEndingDate,
        ),
      ],
    });
  }

  async sendFeePaymentReminder(
    data: {
      phone: string;
      parentName: string;
      studentName: string;
      studentId: string;
      pendingAmount: number;
      dueDate:
        Date | string;
    },
  ) {
    if (
      !data.parentName
        ?.trim()
    ) {
      throw new BadRequestException(
        'Parent name is required for fee reminder',
      );
    }

    if (
      !data.studentName
        ?.trim()
    ) {
      throw new BadRequestException(
        'Student name is required for fee reminder',
      );
    }

    if (
      !data.studentId
        ?.trim()
    ) {
      throw new BadRequestException(
        'Student ID is required for Pay Now button',
      );
    }

    return this.sendTemplate({
      phone:
        data.phone,

      templateName:
        'fee_payment_reminder',

      languageCode:
        'en',

      /*
       * Future / existing reminder template.
       * Keep this method unchanged.
       */
      buttonUrlParameter:
        `${data.studentId.trim()}?source=reminder`,

      bodyParameters: [
        data.parentName.trim(),

        data.studentName.trim(),

        this.formatAmount(
          data.pendingAmount,
        ),

        this.formatDate(
          data.dueDate,
        ),
      ],
    });
  }

  /*
   * CURRENT APPROVED REMINDER TEMPLATE
   *
   * Template:
   * fee_due_reminder
   *
   * Body:
   * {{1}} = Student Name
   * {{2}} = Course Name
   * {{3}} = Pending Fee Amount
   *
   * Approved template button URL:
   *
   * https://sk-learnings-mobile-frontend.vercel.app/pay-fees/{{1}}
   *
   * Meta requires the dynamic button parameter.
   * Therefore studentId must be sent.
   */
  async sendFeeDueReminder(
    data: {
      phone: string;
      studentName: string;
      studentId: string;
      courseName?: string;
      course?: string;
      pendingAmount: number;
    },
  ) {
    const studentName =
      String(
        data.studentName ||
          '',
      ).trim();

    const courseName =
      String(
        data.courseName ||
          data.course ||
          '',
      ).trim();

    const studentId =
      String(
        data.studentId ||
          '',
      )
        .replace(
          /\{\{1\}\}/g,
          '',
        )
        .split('?')[0]
        .trim();

    if (!studentName) {
      throw new BadRequestException(
        'Student name is required for fee due reminder',
      );
    }

    if (!courseName) {
      throw new BadRequestException(
        'Course name is required for fee due reminder',
      );
    }

    if (!studentId) {
      throw new BadRequestException(
        'Student ID is required for fee due reminder button',
      );
    }

    return this.sendTemplate({
      phone:
        data.phone,

      templateName:
        'fee_due_reminder',

      languageCode:
        'en',

      bodyParameters: [
        studentName,

        courseName,

        this.formatAmount(
          Number(
            data.pendingAmount ||
              0,
          ),
        ),
      ],

      buttonUrlParameter:
        studentId,
    });
  }

  async sendFeePaymentReceipt(
    data: {
      phone: string;

      parentName: string;

      studentName: string;

      paidAmount: number;

      paymentMethod: string;

      paymentDate:
        Date | string;

      remainingBalance: number;

      pdfBuffer: Buffer;

      receiptNumber: string;
    },
  ) {
    if (
      !data.parentName
        ?.trim()
    ) {
      throw new BadRequestException(
        'Parent name is required for payment receipt',
      );
    }

    if (
      !data.studentName
        ?.trim()
    ) {
      throw new BadRequestException(
        'Student name is required for payment receipt',
      );
    }

    const {
      mediaId,
      filename,
    } =
      await this.uploadPdf(
        data.pdfBuffer,
        `${data.receiptNumber}.pdf`,
      );

    return this.sendTemplate({
      phone:
        data.phone,

      templateName:
        'fee_payment_receipt',

      languageCode:
        'en',

      mediaId,

      documentFilename:
        filename,

      bodyParameters: [
        data.parentName.trim(),

        data.studentName.trim(),

        this.formatAmount(
          data.paidAmount,
        ),

        this.formatPaymentMethod(
          data.paymentMethod,
        ),

        this.formatDate(
          data.paymentDate,
        ),

        this.formatAmount(
          data.remainingBalance,
        ),
      ],
    });
  }

  async sendTestTemplate(
    data: {
      phone: string;

      templateName: string;

      bodyParameters?: string[];

      pdfBuffer?: Buffer;

      filename?: string;
    },
  ) {
    let mediaId:
      string | undefined;

    let documentFilename:
      string | undefined;

    if (
      data.pdfBuffer
    ) {
      const uploaded =
        await this.uploadPdf(
          data.pdfBuffer,
          data.filename ||
            'test-document.pdf',
        );

      mediaId =
        uploaded.mediaId;

      documentFilename =
        uploaded.filename;
    }

    return this.sendTemplate({
      phone:
        data.phone,

      templateName:
        data.templateName,

      languageCode:
        'en',

      bodyParameters:
        data.bodyParameters ||
        [],

      mediaId,

      documentFilename,
    });
  }
}