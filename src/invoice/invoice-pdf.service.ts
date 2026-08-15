import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import puppeteer from 'puppeteer';

import * as fs from 'fs';
import * as path from 'path';

import {
  InvoiceDocument,
} from './invoice.schema';

@Injectable()
export class InvoicePdfService {
  private formatMoney(
    value: number,
  ) {
    return Number(
      value || 0,
    ).toLocaleString(
      'en-IN',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    );
  }

  private formatDate(
    value:
      | Date
      | string
      | null
      | undefined,
  ) {
    if (!value) {
      return '-';
    }

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
        month: 'short',
        year: 'numeric',
      },
    );
  }

  private formatFeeType(
    value:
      | string
      | undefined,
  ) {
    const labels:
      Record<string, string> = {
        monthly:
          'Monthly',

        partial:
          'Partial',

        yearly:
          'Yearly',
      };

    return value
      ? labels[value] ||
          value
      : '-';
  }

  private formatPaymentMethod(
    value:
      | string
      | undefined,
  ) {
    const labels:
      Record<string, string> = {
        cash:
          'Cash',

        bank:
          'Bank',

        upi:
          'UPI',

        qr:
          'QR',
      };

    return value
      ? labels[value] ||
          value
      : '-';
  }

  private escapeHtml(
    value:
      | string
      | number
      | null
      | undefined,
  ) {
    return String(
      value ?? '',
    )
      .replace(
        /&/g,
        '&amp;',
      )
      .replace(
        /</g,
        '&lt;',
      )
      .replace(
        />/g,
        '&gt;',
      )
      .replace(
        /"/g,
        '&quot;',
      )
      .replace(
        /'/g,
        '&#039;',
      );
  }

  private getLogoBase64() {
    try {
      const possiblePaths = [
        path.join(
          process.cwd(),
          'src',
          'assets',
          'sk-logo.png',
        ),

        path.join(
          process.cwd(),
          'dist',
          'assets',
          'sk-logo.png',
        ),
      ];

      const logoPath =
        possiblePaths.find(
          (
            filePath,
          ) =>
            fs.existsSync(
              filePath,
            ),
        );

      if (!logoPath) {
        console.warn(
          'SK logo file not found',
        );

        return '';
      }

      const logoBuffer =
        fs.readFileSync(
          logoPath,
        );

      return `data:image/png;base64,${logoBuffer.toString(
        'base64',
      )}`;
    } catch (error) {
      console.error(
        'Invoice logo load error:',
        error,
      );

      return '';
    }
  }

  private buildHtml(
    invoice:
      InvoiceDocument,
  ) {
    const logoBase64 =
      this.getLogoBase64();

    const isReceipt =
      invoice.invoiceType ===
      'payment_receipt';

    const business =
      invoice.business ||
      ({} as any);

    const student =
      invoice.student ||
      ({} as any);

    const fee =
      invoice.fee ||
      ({} as any);

    const totalFee =
      Number(
        fee.totalFee ||
          invoice.invoiceAmount ||
          0,
      );

    const paidAmount =
      Number(
        invoice.paidAmount ||
          0,
      );

    const pendingAmount =
      Number(
        invoice.pendingAmount ??
          Math.max(
            0,
            totalFee -
              paidAmount,
          ),
      );

    const isFullyPaid =
      isReceipt &&
      (
        invoice.paymentStatus ===
          'paid' ||
        pendingAmount <= 0
      );

    const feePlanText =
      fee.feeType ===
      'monthly'
        ? `Rs. ${this.formatMoney(
            fee.monthlyAmount,
          )} × ${
            fee.selectedMonths ||
            '-'
          } months`
        : fee.feeType ===
            'partial'
          ? `Minimum Rs. ${this.formatMoney(
              fee.minimumPartialAmount,
            )}`
          : 'Full fee payment';

    const statusClass =
      isReceipt
        ? isFullyPaid
          ? 'paid'
          : 'received'
        : 'unpaid';

    const documentTitle =
      isReceipt
        ? 'PAYMENT RECEIPT'
        : 'FEE INVOICE';

    const documentStatus =
      isReceipt
        ? isFullyPaid
          ? 'PAID'
          : 'RECEIVED'
        : 'PAYMENT DUE';

    const statusText =
      isReceipt
        ? isFullyPaid
          ? 'Paid'
          : 'Partial'
        : invoice.paymentStatus ===
            'partial'
          ? 'Partial'
          : 'Unpaid';

    const logoHtml =
      logoBase64
        ? `
          <img
            src="${logoBase64}"
            alt="The SK Learnings"
          />
        `
        : `
          <div class="logo-fallback">
            SK
          </div>
        `;

    const qrHtml =
      business.qrCode
        ? `
          <img
            src="${business.qrCode}"
            alt="Payment QR Code"
          />
        `
        : `
          <div class="qr-missing">
            QR not configured
          </div>
        `;

    const receiptMeta =
      isReceipt
        ? `
          <div class="payment-meta">
            <div>
              <span>
                This Payment
              </span>

              <strong>
                Rs. ${this.formatMoney(
                  invoice.invoiceAmount,
                )}
              </strong>
            </div>

            <div>
              <span>
                Payment Method
              </span>

              <strong>
                ${this.escapeHtml(
                  this.formatPaymentMethod(
                    invoice.paymentMethod,
                  ),
                )}
              </strong>
            </div>

            <div>
              <span>
                Remaining Balance
              </span>

              <strong>
                Rs. ${this.formatMoney(
                  pendingAmount,
                )}
              </strong>
            </div>
          </div>
        `
        : '';

    const bottomSection =
      !isReceipt
        ? `
          <section class="payment-area">
            <div class="qr-panel">
              <div>
                <span class="section-title">
                  Scan & Pay
                </span>

                <p>
                  Scan the QR using any supported UPI app.
                </p>
              </div>

              ${qrHtml}
            </div>

            <div class="instructions">
              <div class="section-title">
                Payment Instructions
              </div>

              <ol>
                <li>
                  Scan the QR code and complete the fee payment.
                </li>

                <li>
                  Share the payment screenshot in WhatsApp for verification.
                </li>

                <li>
                  After verification, the payment receipt will be generated.
                </li>
              </ol>

              ${
                business.invoiceTerms
                  ? `
                    <p>
                      <strong>
                        Terms:
                      </strong>

                      ${this.escapeHtml(
                        business.invoiceTerms,
                      )}
                    </p>
                  `
                  : ''
              }
            </div>

            <div class="total-box">
              <span>
                Amount Payable
              </span>

              <strong>
                Rs. ${this.formatMoney(
                  invoice.invoiceAmount,
                )}
              </strong>
            </div>
          </section>
        `
        : `
          <section class="paid-section">
            <div class="paid-badge">
              <div class="check-icon">
                ✓
              </div>

              <div>
                <span>
                  PAYMENT RECEIVED
                </span>

                <strong>
                  Rs. ${this.formatMoney(
                    invoice.invoiceAmount,
                  )}
                </strong>

                <p>
                  Payment has been recorded successfully.
                </p>
              </div>
            </div>

            ${
              pendingAmount >
              0
                ? `
                  <div class="balance-box">
                    <span>
                      Remaining Balance
                    </span>

                    <strong>
                      Rs. ${this.formatMoney(
                        pendingAmount,
                      )}
                    </strong>

                    <p>
                      Continue payments as per the selected fee plan.
                    </p>
                  </div>
                `
                : `
                  <div class="balance-box completed">
                    <span>
                      Fee Status
                    </span>

                    <strong>
                      FULLY PAID
                    </strong>

                    <p>
                      No pending balance for this fee setup.
                    </p>
                  </div>
                `
            }
          </section>
        `;

    return `
<!DOCTYPE html>

<html>
<head>
  <meta charset="UTF-8" />

  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 210mm;
      height: 297mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      overflow: hidden;
    }

    .a4-page {
      width: 210mm;
      height: 297mm;
      padding: 8mm 10mm;
      background: #ffffff;
    }

    .invoice-document {
      width: 100%;
      min-height: 0;
      margin: 0 auto;
      overflow: hidden;
      border: 1px solid #e5e8eb;
      background: #ffffff;
      color: #28323c;
    }

    .invoice-header {
      min-height: 70px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 11px 16px;
      border-bottom: 3px solid #ffb800;
      background: #050505;
    }

    .brand {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-logo {
      width: 46px;
      height: 46px;
      flex: 0 0 46px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-logo img {
      width: 46px;
      height: 46px;
      object-fit: contain;
    }

    .logo-fallback {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #ffb800;
      border-radius: 50%;
      background: #111111;
      color: #ffffff;
      font-size: 11px;
      font-weight: 900;
    }

    .brand h1 {
      margin: 0;
      color: #ffb800;
      font-size: 18px;
      line-height: 1;
    }

    .brand p {
      margin: 4px 0 0;
      color: #ffffff;
      font-size: 7px;
      letter-spacing: 1.8px;
    }

    .brand strong {
      display: block;
      margin-top: 4px;
      color: #ffb800;
      font-size: 5.5px;
      letter-spacing: 0.4px;
    }

    .document-status {
      min-width: 100px;
      padding: 7px 9px;
      border-radius: 7px;
      text-align: right;
    }

    .document-status.unpaid {
      border: 1px solid rgba(255, 184, 0, 0.45);
      background: rgba(255, 184, 0, 0.09);
    }

    .document-status.paid {
      border: 1px solid rgba(107, 205, 139, 0.45);
      background: rgba(87, 176, 115, 0.1);
    }

    .document-status.received {
      border: 1px solid rgba(255, 184, 0, 0.42);
      background: rgba(255, 184, 0, 0.08);
    }

    .document-status span {
      display: block;
      color: #d8dde2;
      font-size: 5.5px;
      font-weight: 700;
      letter-spacing: 0.6px;
    }

    .document-status strong {
      display: block;
      margin-top: 3px;
      font-size: 11px;
    }

    .document-status.unpaid strong {
      color: #ffb800;
    }

    .document-status.paid strong {
      color: #7cdaa0;
    }

    .document-status.received strong {
      color: #ffca42;
    }

    .meta-bar {
      display: grid;
      grid-template-columns:
        repeat(
          4,
          minmax(0, 1fr)
        );
      border-bottom: 1px solid #e7ebee;
      background: #fafbfc;
    }

    .meta-bar > div {
      min-width: 0;
      padding: 7px 10px;
      border-right: 1px solid #e7ebee;
    }

    .meta-bar > div:last-child {
      border-right: 0;
    }

    .meta-bar span,
    .meta-bar strong {
      display: block;
    }

    .meta-bar span {
      color: #8a949e;
      font-size: 5px;
      font-weight: 750;
      text-transform: uppercase;
    }

    .meta-bar strong {
      margin-top: 2px;
      color: #35414c;
      font-size: 6.8px;
    }

    .status-paid {
      color: #31844e !important;
    }

    .status-unpaid {
      color: #aa7400 !important;
    }

    .status-received {
      color: #a57500 !important;
    }

    .party-grid {
      display: grid;
      grid-template-columns:
        1.15fr
        0.85fr;
      gap: 8px;
      padding: 10px 16px 8px;
    }

    .party-block {
      min-width: 0;
      padding: 8px 9px;
      border: 1px solid #e1e6ea;
      border-radius: 7px;
      background: #ffffff;
    }

    .section-title {
      display: block;
      margin-bottom: 6px;
      color: #2e3944;
      font-size: 7.5px;
      font-weight: 800;
    }

    .detail-grid {
      display: grid;
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
      gap: 6px 10px;
    }

    .detail.wide {
      grid-column: 1 / -1;
    }

    .detail span,
    .detail strong {
      display: block;
    }

    .detail span {
      color: #919aa3;
      font-size: 4.8px;
      font-weight: 720;
      text-transform: uppercase;
    }

    .detail strong {
      margin-top: 2px;
      overflow-wrap: anywhere;
      color: #3d4853;
      font-size: 6.4px;
      line-height: 1.3;
    }

    .fee-section {
      padding: 1px 16px 8px;
    }

    .fee-table {
      overflow: hidden;
      border: 1px solid #dfe4e8;
      border-radius: 6px;
    }

    .fee-head,
    .fee-row {
      display: grid;
      grid-template-columns:
        2fr
        0.8fr
        0.85fr
        0.85fr
        0.9fr;
      align-items: center;
    }

    .fee-head {
      min-height: 24px;
      background: #ffb800;
    }

    .fee-head span {
      padding: 0 7px;
      color: #1e1e1e;
      font-size: 5px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .fee-row {
      min-height: 38px;
    }

    .fee-row > * {
      min-width: 0;
      padding: 6px 7px;
      border-right: 1px solid #e7eaed;
      font-size: 6.2px;
    }

    .fee-row > *:last-child {
      border-right: 0;
    }

    .fee-description strong,
    .fee-description span {
      display: block;
    }

    .fee-description span {
      margin-top: 2px;
      color: #929ba4;
      font-size: 5px;
    }

    .payment-meta {
      display: grid;
      grid-template-columns:
        repeat(
          3,
          minmax(0, 1fr)
        );
      gap: 6px;
      margin-top: 6px;
    }

    .payment-meta > div {
      padding: 6px 8px;
      border: 1px solid #e0e5e9;
      border-radius: 6px;
      background: #fafbfc;
    }

    .payment-meta span,
    .payment-meta strong {
      display: block;
    }

    .payment-meta span {
      color: #929aa3;
      font-size: 4.8px;
      font-weight: 720;
      text-transform: uppercase;
    }

    .payment-meta strong {
      margin-top: 2px;
      color: #35414c;
      font-size: 6.7px;
    }

    .payment-area {
      position: relative;
      display: grid;
      grid-template-columns:
        0.72fr
        1.28fr;
      gap: 8px;
      padding: 1px 16px 40px;
    }

    .qr-panel,
    .instructions {
      min-height: 118px;
      padding: 8px;
      border: 1px solid #e1e6ea;
      border-radius: 7px;
    }

    .qr-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .qr-panel p {
      max-width: 90px;
      margin: -2px 0 0;
      color: #89939d;
      font-size: 5px;
      line-height: 1.4;
    }

    .qr-panel img,
    .qr-missing {
      width: 82px;
      height: 82px;
      flex: 0 0 82px;
      border-radius: 5px;
    }

    .qr-panel img {
      object-fit: contain;
      padding: 3px;
      border: 1px solid #e1e5e8;
      background: #ffffff;
    }

    .qr-missing {
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px dashed #d9dee2;
      color: #9aa2aa;
      font-size: 5.3px;
    }

    .instructions ol {
      margin: 0;
      padding-left: 14px;
    }

    .instructions li {
      margin-bottom: 5px;
      color: #53606b;
      font-size: 5.8px;
      line-height: 1.35;
    }

    .instructions p {
      margin: 6px 0 0;
      color: #66717c;
      font-size: 5.2px;
      line-height: 1.35;
    }

    .total-box {
      position: absolute;
      right: 16px;
      bottom: 7px;
      width: calc(64% - 22px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 9px;
      border: 1px solid #e8c85c;
      border-radius: 6px;
      background: #fff9e8;
    }

    .total-box span {
      color: #9b6a00;
      font-size: 5.8px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .total-box strong {
      color: #9d6500;
      font-size: 12px;
    }

    .paid-section {
      display: grid;
      grid-template-columns:
        1.25fr
        0.75fr;
      gap: 8px;
      padding: 1px 16px 10px;
    }

    .paid-badge,
    .balance-box {
      min-height: 78px;
      display: flex;
      align-items: center;
      padding: 10px;
      border-radius: 7px;
    }

    .paid-badge {
      gap: 10px;
      border: 1px solid #c6e1cf;
      background: #f3faf5;
    }

    .check-icon {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #3e965b;
      border-radius: 50%;
      color: #3e965b;
      font-size: 20px;
      font-weight: 900;
    }

    .paid-badge span,
    .paid-badge strong,
    .paid-badge p,
    .balance-box span,
    .balance-box strong,
    .balance-box p {
      display: block;
    }

    .paid-badge span,
    .balance-box span {
      color: #6c7b70;
      font-size: 5px;
      font-weight: 800;
    }

    .paid-badge strong {
      margin-top: 3px;
      color: #2f824b;
      font-size: 15px;
    }

    .paid-badge p,
    .balance-box p {
      margin: 3px 0 0;
      color: #768179;
      font-size: 5.3px;
    }

    .balance-box {
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      border: 1px solid #e1e6ea;
      background: #fafbfc;
    }

    .balance-box strong {
      margin-top: 4px;
      color: #35414c;
      font-size: 12px;
    }

    .balance-box.completed {
      border-color: #c6e1cf;
      background: #f3faf5;
    }

    .balance-box.completed strong {
      color: #31844e;
    }

    .invoice-footer {
      min-height: 34px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 7px 16px;
      border-top: 2px solid #ffb800;
      background: #050505;
      color: #ffffff;
    }

    .invoice-footer strong,
    .invoice-footer span {
      display: block;
    }

    .invoice-footer strong {
      color: #ffb800;
      font-size: 5.5px;
    }

    .invoice-footer span {
      margin-top: 2px;
      color: #b8bec4;
      font-size: 4.8px;
    }

    .footer-brand {
      color: #ffb800;
      font-size: 5.8px;
      font-weight: 800;
      white-space: nowrap;
    }
  </style>
</head>

<body>
  <main class="a4-page">
    <div class="invoice-document">

      <header class="invoice-header">
        <div class="brand">
          <div class="brand-logo">
            ${logoHtml}
          </div>

          <div>
            <h1>
              THE SK LEARNINGS
            </h1>

            <p>
              PRIVATE EDUCATIONAL SERVICES
            </p>

            <strong>
              MEDICAL / ENGINEERING / FOUNDATIONS / JUNIOR IAS
            </strong>
          </div>
        </div>

        <div
          class="document-status ${statusClass}"
        >
          <span>
            ${documentTitle}
          </span>

          <strong>
            ${documentStatus}
          </strong>
        </div>
      </header>

      <section class="meta-bar">
        <div>
          <span>
            Invoice No
          </span>

          <strong>
            ${this.escapeHtml(
              invoice.invoiceNumber,
            )}
          </strong>
        </div>

        <div>
          <span>
            Invoice Date
          </span>

          <strong>
            ${this.formatDate(
              invoice.invoiceDate,
            )}
          </strong>
        </div>

        <div>
          <span>
            ${
              isReceipt
                ? 'Payment Date'
                : 'Due Date'
            }
          </span>

          <strong>
            ${this.formatDate(
              isReceipt
                ? invoice.paymentDate
                : invoice.dueDate,
            )}
          </strong>
        </div>

        <div>
          <span>
            Status
          </span>

          <strong
            class="status-${statusClass}"
          >
            ${statusText}
          </strong>
        </div>
      </section>

      <section class="party-grid">
        <div class="party-block">
          <div class="section-title">
            Student Details
          </div>

          <div class="detail-grid">
            <div class="detail">
              <span>
                Student
              </span>

              <strong>
                ${this.escapeHtml(
                  student.studentName,
                )}
              </strong>
            </div>

            <div class="detail">
              <span>
                Roll No
              </span>

              <strong>
                ${this.escapeHtml(
                  student.rollNo,
                )}
              </strong>
            </div>

            <div class="detail">
              <span>
                Course
              </span>

              <strong>
                ${this.escapeHtml(
                  student.course,
                )}
              </strong>
            </div>

            <div class="detail">
              <span>
                Batch
              </span>

              <strong>
                ${this.escapeHtml(
                  student.batch ||
                    '-',
                )}
              </strong>
            </div>

            <div class="detail">
              <span>
                Parent
              </span>

              <strong>
                ${this.escapeHtml(
                  student.parentName,
                )}
              </strong>
            </div>

            <div class="detail">
              <span>
                Phone
              </span>

              <strong>
                ${this.escapeHtml(
                  student.phone,
                )}
              </strong>
            </div>
          </div>
        </div>

        <div class="party-block">
          <div class="section-title">
            Invoice From
          </div>

          <div class="detail-grid">
            <div class="detail">
              <span>
                Owner
              </span>

              <strong>
                ${this.escapeHtml(
                  business.ownerName ||
                    '-',
                )}
              </strong>
            </div>

            <div class="detail">
              <span>
                GST No
              </span>

              <strong>
                ${this.escapeHtml(
                  business.gstNumber ||
                    '-',
                )}
              </strong>
            </div>

            <div class="detail wide">
              <span>
                Address
              </span>

              <strong>
                ${this.escapeHtml(
                  business.address ||
                    '-',
                )}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section class="fee-section">
        <div class="section-title">
          ${
            isReceipt
              ? 'Payment Summary'
              : 'Fee Details'
          }
        </div>

        <div class="fee-table">
          <div class="fee-head">
            <span>
              Description
            </span>

            <span>
              Fee Type
            </span>

            <span>
              Total
            </span>

            <span>
              Paid
            </span>

            <span>
              Pending
            </span>
          </div>

          <div class="fee-row">
            <div class="fee-description">
              <strong>
                ${this.escapeHtml(
                  student.course ||
                    'Course Fee',
                )}
              </strong>

              <span>
                ${this.escapeHtml(
                  feePlanText,
                )}
              </span>
            </div>

            <strong>
              ${this.escapeHtml(
                this.formatFeeType(
                  fee.feeType,
                ),
              )}
            </strong>

            <strong>
              Rs. ${this.formatMoney(
                totalFee,
              )}
            </strong>

            <strong>
              Rs. ${this.formatMoney(
                isReceipt
                  ? paidAmount
                  : 0,
              )}
            </strong>

            <strong>
              Rs. ${this.formatMoney(
                isReceipt
                  ? pendingAmount
                  : totalFee,
              )}
            </strong>
          </div>
        </div>

        ${receiptMeta}
      </section>

      ${bottomSection}

      <footer class="invoice-footer">
        <div>
          <strong>
            ${this.escapeHtml(
              business.invoiceFooter ||
                'Thank you for choosing The SK Learnings',
            )}
          </strong>

          <span>
            ${this.escapeHtml(
              business.address ||
                '',
            )}
          </span>
        </div>

        <div class="footer-brand">
          THE SK LEARNINGS
        </div>
      </footer>
    </div>
  </main>
</body>
</html>
    `;
  }

  async generatePdfBuffer(
    invoice:
      InvoiceDocument,
  ): Promise<Buffer> {
    let browser:
      Awaited<
        ReturnType<
          typeof puppeteer.launch
        >
      > | null =
      null;

    try {
      browser =
        await puppeteer.launch({
          headless:
            true,

          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
        });

      const page =
        await browser.newPage();

      await page.setViewport({
        width:
          794,

        height:
          1123,

        deviceScaleFactor:
          1,
      });

      const html =
        this.buildHtml(
          invoice,
        );

      await page.setContent(
        html,
        {
          waitUntil:
            'load',
        },
      );

      await page.emulateMediaType(
        'screen',
      );

      const pdf =
        await page.pdf({
          format:
            'A4',

          landscape:
            false,

          printBackground:
            true,

          preferCSSPageSize:
            true,

          scale:
            0.88,

          margin: {
            top:
              '0mm',

            right:
              '0mm',

            bottom:
              '0mm',

            left:
              '0mm',
          },
        });

      return Buffer.from(
        pdf,
      );
    } catch (error) {
      console.error(
        'Invoice PDF generation error:',
        error,
      );

      throw new InternalServerErrorException(
        'Unable to generate invoice PDF',
      );
    } finally {
      if (
        browser
      ) {
        await browser.close();
      }
    }
  }
}