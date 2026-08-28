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
      Record<
        string,
        string
      > = {
        monthly:
          'Monthly',

        partial:
          'Part Payment',

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
      Record<
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

    const monthlyInstallments =
      Array.isArray(
        fee.monthlyInstallments,
      )
        ? fee.monthlyInstallments
        : [];

    const paymentHistory =
      Array.isArray(
        fee.paymentHistory,
      )
        ? fee.paymentHistory
        : [];

    const currentPayableAmount =
      Number(
        fee.currentPayableAmount ??
          invoice.invoiceAmount ??
          0,
      );

    const currentInstallmentNumber =
      Number(
        fee.currentInstallmentNumber ||
          0,
      );

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
        ? `${
            fee.selectedMonths ||
            '-'
          } monthly installments`
        : fee.feeType ===
            'partial'
          ? 'Flexible part payments'
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
          : 'Part Payment'
        : invoice.paymentStatus ===
            'partial'
          ? 'Part Payment'
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

    const receiptPaymentMeta =
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

    const monthlyScheduleHtml =
      fee.feeType ===
        'monthly' &&
      monthlyInstallments.length >
        0
        ? `
          <section class="installment-section">
            <div class="section-title">
              MONTHLY INSTALLMENT SCHEDULE
            </div>

            <div class="installment-table">
              <div class="installment-head">
                <span>Month</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Paid Date</span>
              </div>

              ${monthlyInstallments
                .map(
                  (
                    installment:
                      any,
                  ) => `
                    <div class="installment-row ${
                      installment.status ===
                      'paid'
                        ? 'paid'
                        : Number(
                              installment.installmentNumber,
                            ) ===
                            currentInstallmentNumber
                          ? 'current'
                          : ''
                    }">
                      <span>
                        Month ${this.escapeHtml(
                          installment.installmentNumber,
                        )}
                      </span>

                      <strong>
                        Rs. ${this.formatMoney(
                          installment.amount,
                        )}
                      </strong>

                      <span class="installment-status ${
                        installment.status ===
                        'paid'
                          ? 'paid'
                          : 'unpaid'
                      }">
                        ${
                          installment.status ===
                          'paid'
                            ? 'Paid'
                            : 'Unpaid'
                        }
                      </span>

                      <span>
                        ${
                          installment.paidAt
                            ? this.formatDate(
                                installment.paidAt,
                              )
                            : '-'
                        }
                      </span>
                    </div>
                  `,
                )
                .join('')}
            </div>

            <div class="current-payable-strip">
              <span>
                ${
                  currentPayableAmount >
                    0 &&
                  currentInstallmentNumber >
                    0
                    ? `Current Payable • Month ${currentInstallmentNumber}`
                    : 'Current Payable'
                }
              </span>

              <strong>
                Rs. ${this.formatMoney(
                  currentPayableAmount,
                )}
              </strong>
            </div>
          </section>
        `
        : '';

    const partialHistoryHtml =
      fee.feeType ===
        'partial' &&
      paymentHistory.length >
        0
        ? `
          <section class="installment-section">
            <div class="section-title">
              PART PAYMENT HISTORY
            </div>

            <div class="installment-table">
              <div class="partial-history-head">
                <span>Payment</span>
                <span>Amount</span>
                <span>Date</span>
                <span>Method</span>
              </div>

              ${paymentHistory
                .map(
                  (
                    item:
                      any,
                    index:
                      number,
                  ) => `
                    <div class="partial-history-row">
                      <span>
                        Payment ${index + 1}
                      </span>

                      <strong>
                        Rs. ${this.formatMoney(
                          item.amount,
                        )}
                      </strong>

                      <span>
                        ${this.formatDate(
                          item.paymentDate,
                        )}
                      </span>

                      <span>
                        ${this.escapeHtml(
                          this.formatPaymentMethod(
                            item.paymentMethod,
                          ),
                        )}
                      </span>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </section>
        `
        : '';

    const bottomSection =
      !isReceipt
        ? `
          <section class="bottom-grid">
            <div class="payment-panel">
              <div class="section-label">
                PAYMENT INFORMATION
              </div>

              <div class="payment-panel-content">
                <div class="payment-copy">
                  <strong>
                    Scan & Pay
                  </strong>

                  <p>
                    Use the QR code to complete the fee payment.
                  </p>

                  <p>
                    After completing the payment, share the screenshot in WhatsApp for verification.
                  </p>
                </div>

                <div class="qr-wrap">
                  ${qrHtml}
                </div>
              </div>
            </div>

            <div class="summary-panel">
              <div class="summary-row">
                <span>
                  Total Fee
                </span>

                <strong>
                  Rs. ${this.formatMoney(
                    totalFee,
                  )}
                </strong>
              </div>

              <div class="summary-row">
                <span>
                  Already Paid
                </span>

                <strong>
                  Rs. ${this.formatMoney(
                    paidAmount,
                  )}
                </strong>
              </div>

              <div class="summary-row total">
                <span>
                  Amount Payable
                </span>

                <strong>
                  Rs. ${this.formatMoney(
                    invoice.invoiceAmount ||
                      currentPayableAmount,
                  )}
                </strong>
              </div>

              <div class="terms-block">
                <div class="section-label">
                  TERMS & NOTES
                </div>

                <p>
                  1. Please complete the payment on or before the due date.
                </p>

                <p>
                  2. Share the payment screenshot through WhatsApp after payment.
                </p>

                ${
                  business.invoiceTerms
                    ? `
                      <p>
                        3. ${this.escapeHtml(
                          business.invoiceTerms,
                        )}
                      </p>
                    `
                    : ''
                }
              </div>
            </div>
          </section>
        `
        : `
          <section class="receipt-bottom">
            <div class="payment-received-box">
              <div class="received-icon">
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
                      REMAINING BALANCE
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
                      FEE STATUS
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
      min-height: 297mm;
      height: auto;
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;

      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      overflow: visible;
    }

    .invoice-page {
      width: 210mm;
      min-height: 297mm;
      height: auto;

      display: flex;
      flex-direction: column;

      background: #ffffff;

      color: #26313c;

      overflow: visible;
    }

    .invoice-header {
      min-height: 35mm;

      display: flex;
      align-items: center;
      justify-content: space-between;

      padding: 7mm 10mm;

      background: #050505;

      border-bottom: 1.5mm solid #ffb800;
    }

    .brand {
      display: flex;
      align-items: center;

      gap: 4mm;
    }

    .brand-logo {
      width: 19mm;
      height: 19mm;

      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-logo img {
      width: 100%;
      height: 100%;

      object-fit: contain;
    }

    .logo-fallback {
      width: 18mm;
      height: 18mm;

      display: flex;
      align-items: center;
      justify-content: center;

      border: 2px solid #ffb800;
      border-radius: 50%;

      color: #ffffff;

      font-size: 12px;
      font-weight: 900;
    }

    .brand h1 {
      margin: 0;

      color: #ffb800;

      font-size: 23px;
      line-height: 1;
    }

    .brand p {
      margin: 5px 0 0;

      color: #ffffff;

      font-size: 8px;

      letter-spacing: 2px;
    }

    .brand small {
      display: block;

      margin-top: 5px;

      color: #ffb800;

      font-size: 6px;

      letter-spacing: 0.5px;
    }

    .document-box {
      min-width: 43mm;

      padding: 4mm;

      border-radius: 8px;

      text-align: right;
    }

    .document-box.unpaid {
      border: 1px solid rgba(255, 184, 0, 0.45);

      background: rgba(255, 184, 0, 0.08);
    }

    .document-box.received {
      border: 1px solid rgba(255, 184, 0, 0.45);

      background: rgba(255, 184, 0, 0.08);
    }

    .document-box.paid {
      border: 1px solid rgba(105, 210, 140, 0.45);

      background: rgba(70, 160, 100, 0.12);
    }

    .document-box span {
      display: block;

      color: #d6dbe0;

      font-size: 7px;

      font-weight: 800;

      letter-spacing: 1px;
    }

    .document-box strong {
      display: block;

      margin-top: 5px;

      font-size: 16px;
    }

    .document-box.unpaid strong,
    .document-box.received strong {
      color: #ffb800;
    }

    .document-box.paid strong {
      color: #79d99b;
    }

    .meta-bar {
      min-height: 18mm;

      display: grid;

      grid-template-columns:
        repeat(
          4,
          minmax(
            0,
            1fr
          )
        );

      border-bottom:
        1px solid
        #e1e6ea;

      background:
        #fafbfc;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      justify-content: center;

      padding:
        3mm
        5mm;

      border-right:
        1px solid
        #e1e6ea;
    }

    .meta-item:last-child {
      border-right: 0;
    }

    .meta-item span {
      color:
        #8b949e;

      font-size:
        6px;

      font-weight:
        800;

      text-transform:
        uppercase;
    }

    .meta-item strong {
      margin-top:
        4px;

      color:
        #35414c;

      font-size:
        9px;
    }

    .meta-item strong.paid {
      color:
        #31844e;
    }

    .meta-item strong.unpaid,
    .meta-item strong.received {
      color:
        #9d6c00;
    }

    .party-section {
      display:
        grid;

      grid-template-columns:
        1.08fr
        0.92fr;

      gap:
        4mm;

      padding:
        6mm
        10mm
        4mm;
    }

    .party-card {
      min-height:
        43mm;

      padding:
        4mm;

      border:
        1px solid
        #dfe4e8;

      border-radius:
        8px;

      background:
        #ffffff;
    }

    .section-title {
      margin-bottom:
        4mm;

      color:
        #303b46;

      font-size:
        10px;

      font-weight:
        800;
    }

    .detail-grid {
      display:
        grid;

      grid-template-columns:
        repeat(
          2,
          minmax(
            0,
            1fr
          )
        );

      gap:
        3mm
        5mm;
    }

    .detail.wide {
      grid-column:
        1 / -1;
    }

    .detail span,
    .detail strong {
      display:
        block;
    }

    .detail span {
      color:
        #8d969f;

      font-size:
        6px;

      font-weight:
        800;

      text-transform:
        uppercase;
    }

    .detail strong {
      margin-top:
        2px;

      color:
        #3c4752;

      font-size:
        8px;

      line-height:
        1.4;

      overflow-wrap:
        anywhere;
    }

    .fee-section {
      padding:
        1mm
        10mm
        4mm;
    }

    .fee-table {
      overflow:
        hidden;

      border:
        1px solid
        #dfe4e8;

      border-radius:
        7px;
    }

    .fee-table-head,
    .fee-table-row {
      display:
        grid;

      grid-template-columns:
        2fr
        0.9fr
        0.9fr
        0.9fr
        0.9fr;

      align-items:
        center;
    }

    .fee-table-head {
      min-height:
        11mm;

      background:
        #ffb800;
    }

    .fee-table-head div {
      padding:
        0
        3mm;

      color:
        #181818;

      font-size:
        6px;

      font-weight:
        900;

      text-transform:
        uppercase;
    }

    .fee-table-row {
      min-height:
        18mm;

      background:
        #ffffff;
    }

    .fee-table-row > div {
      min-height:
        18mm;

      display:
        flex;

      flex-direction:
        column;

      justify-content:
        center;

      padding:
        3mm;

      border-right:
        1px solid
        #e5e9ec;

      color:
        #36414c;

      font-size:
        8px;

      font-weight:
        700;
    }

    .fee-table-row > div:last-child {
      border-right:
        0;
    }

    .fee-description span {
      margin-top:
        3px;

      color:
        #8e979f;

      font-size:
        6px;

      font-weight:
        400;
    }

    .payment-meta {
      display:
        grid;

      grid-template-columns:
        repeat(
          3,
          minmax(
            0,
            1fr
          )
        );

      gap:
        3mm;

      margin-top:
        3mm;
    }

    .payment-meta > div {
      min-height:
        16mm;

      display:
        flex;

      flex-direction:
        column;

      justify-content:
        center;

      padding:
        3mm;

      border:
        1px solid
        #dfe4e8;

      border-radius:
        7px;

      background:
        #fafbfc;
    }

    .payment-meta span {
      color:
        #8e979f;

      font-size:
        6px;

      font-weight:
        800;

      text-transform:
        uppercase;
    }

    .payment-meta strong {
      margin-top:
        3px;

      color:
        #35414c;

      font-size:
        9px;
    }

    .bottom-grid {
      flex:
        1;

      display:
        grid;

      grid-template-columns:
        0.9fr
        1.1fr;

      gap:
        5mm;

      padding:
        2mm
        10mm
        7mm;
    }

    .payment-panel,
    .summary-panel {
      min-height:
        65mm;

      border:
        1px solid
        #dfe4e8;

      border-radius:
        9px;

      background:
        #ffffff;
    }

    .section-label {
      display:
        inline-flex;

      align-items:
        center;

      min-height:
        9mm;

      padding:
        0
        4mm;

      border-radius:
        0
        0
        7px
        0;

      background:
        #050505;

      color:
        #ffb800;

      font-size:
        7px;

      font-weight:
        900;

      letter-spacing:
        0.4px;
    }

    .payment-panel-content {
      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap:
        4mm;

      padding:
        5mm;
    }

    .payment-copy {
      flex:
        1;
    }

    .payment-copy strong {
      color:
        #35414c;

      font-size:
        11px;
    }

    .payment-copy p {
      margin:
        3mm
        0
        0;

      color:
        #68737d;

      font-size:
        7px;

      line-height:
        1.5;
    }

    .qr-wrap {
      width:
        39mm;

      height:
        39mm;

      flex:
        0
        0
        39mm;

      display:
        flex;

      align-items:
        center;

      justify-content:
        center;
    }

    .qr-wrap img {
      width:
        37mm;

      height:
        37mm;

      object-fit:
        contain;

      padding:
        2mm;

      border:
        1px solid
        #dfe4e8;

      border-radius:
        6px;

      background:
        #ffffff;
    }

    .qr-missing {
      width:
        37mm;

      height:
        37mm;

      display:
        flex;

      align-items:
        center;

      justify-content:
        center;

      border:
        1px dashed
        #ccd3d9;

      border-radius:
        6px;

      color:
        #8c969f;

      font-size:
        7px;
    }

    .summary-panel {
      padding:
        4mm;
    }

    .summary-row {
      min-height:
        13mm;

      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      padding:
        0
        4mm;

      border:
        1px solid
        #e1e6ea;

      border-bottom:
        0;

      background:
        #ffffff;
    }

    .summary-row:first-child {
      border-radius:
        7px
        7px
        0
        0;
    }

    .summary-row span {
      color:
        #59646e;

      font-size:
        8px;

      font-weight:
        700;
    }

    .summary-row strong {
      color:
        #2f3943;

      font-size:
        9px;
    }

    .summary-row.total {
      min-height:
        16mm;

      border-bottom:
        1px solid
        #d9b442;

      border-color:
        #d9b442;

      border-radius:
        0
        0
        7px
        7px;

      background:
        #ffb800;
    }

    .summary-row.total span {
      color:
        #171717;

      font-size:
        9px;

      font-weight:
        900;
    }

    .summary-row.total strong {
      color:
        #171717;

      font-size:
        15px;
    }

    .terms-block {
      margin-top:
        5mm;
    }

    .terms-block .section-label {
      border-radius:
        6px;

      background:
        #050505;
    }

    .terms-block p {
      margin:
        3mm
        0
        0;

      color:
        #59646e;

      font-size:
        7px;

      line-height:
        1.45;
    }

    .receipt-bottom {
      flex:
        1;

      display:
        grid;

      grid-template-columns:
        1.25fr
        0.75fr;

      gap:
        5mm;

      padding:
        3mm
        10mm
        8mm;
    }

    .payment-received-box,
    .balance-box {
      min-height:
        58mm;

      display:
        flex;

      align-items:
        center;

      padding:
        6mm;

      border-radius:
        9px;
    }

    .payment-received-box {
      gap:
        5mm;

      border:
        1px solid
        #bfe0c9;

      background:
        #f1faf4;
    }

    .received-icon {
      width:
        18mm;

      height:
        18mm;

      flex:
        0
        0
        18mm;

      display:
        flex;

      align-items:
        center;

      justify-content:
        center;

      border:
        1.5mm solid
        #3e965b;

      border-radius:
        50%;

      color:
        #3e965b;

      font-size:
        25px;

      font-weight:
        900;
    }

    .payment-received-box span,
    .balance-box span {
      display:
        block;

      color:
        #68776d;

      font-size:
        7px;

      font-weight:
        900;
    }

    .payment-received-box strong {
      display:
        block;

      margin-top:
        4px;

      color:
        #2f824b;

      font-size:
        22px;
    }

    .payment-received-box p,
    .balance-box p {
      margin:
        4px
        0
        0;

      color:
        #6f7c73;

      font-size:
        7px;
    }

    .balance-box {
      flex-direction:
        column;

      align-items:
        flex-start;

      justify-content:
        center;

      border:
        1px solid
        #dfe4e8;

      background:
        #fafbfc;
    }

    .balance-box strong {
      display:
        block;

      margin-top:
        5px;

      color:
        #35414c;

      font-size:
        18px;
    }

    .balance-box.completed {
      border-color:
        #bfe0c9;

      background:
        #f1faf4;
    }

    .balance-box.completed strong {
      color:
        #31844e;
    }

    .invoice-footer {
      min-height:
        18mm;

      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap:
        6mm;

      padding:
        4mm
        10mm;

      border-top:
        1mm solid
        #ffb800;

      background:
        #050505;

      color:
        #ffffff;
    }

    .invoice-footer strong {
      display:
        block;

      color:
        #ffb800;

      font-size:
        7px;
    }

    .invoice-footer span {
      display:
        block;

      margin-top:
        3px;

      color:
        #b5bcc2;

      font-size:
        6px;
    }

    .footer-brand {
      color:
        #ffb800;

      font-size:
        8px;

      font-weight:
        900;

      white-space:
        nowrap;
    }
  
    .installment-section {
      padding: 1mm 10mm 4mm;
      break-inside: avoid;
    }

    .installment-table {
      overflow: hidden;
      border: 1px solid #dfe4e8;
      border-radius: 7px;
      background: #ffffff;
    }

    .installment-head,
    .installment-row,
    .partial-history-head,
    .partial-history-row {
      display: grid;
      grid-template-columns: 0.8fr 1fr 0.8fr 1fr;
      align-items: center;
    }

    .installment-head,
    .partial-history-head {
      min-height: 9mm;
      background: #f3f5f7;
      border-bottom: 1px solid #dfe4e8;
    }

    .installment-head span,
    .partial-history-head span {
      padding: 0 3mm;
      color: #6f7a84;
      font-size: 6px;
      font-weight: 900;
      text-transform: uppercase;
    }

    .installment-row,
    .partial-history-row {
      min-height: 9mm;
      border-bottom: 1px solid #edf0f2;
    }

    .installment-row:last-child,
    .partial-history-row:last-child {
      border-bottom: 0;
    }

    .installment-row > *,
    .partial-history-row > * {
      padding: 2mm 3mm;
      color: #46515c;
      font-size: 6.7px;
    }

    .installment-row.current {
      background: #fff9e7;
    }

    .installment-row.paid {
      background: #f5fbf7;
    }

    .installment-status {
      display: inline-flex;
      width: fit-content;
      padding: 1.2mm 2.2mm;
      border-radius: 4px;
      font-weight: 900;
    }

    .installment-status.paid {
      background: #eaf7ee;
      color: #31844e;
    }

    .installment-status.unpaid {
      background: #fff6dc;
      color: #9d7000;
    }

    .current-payable-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4mm;
      margin-top: 2.5mm;
      padding: 3mm 4mm;
      border: 1px solid #d9b442;
      border-radius: 6px;
      background: #ffb800;
    }

    .current-payable-strip span,
    .current-payable-strip strong {
      color: #171717;
      font-weight: 900;
    }

    .current-payable-strip span {
      font-size: 7px;
      text-transform: uppercase;
    }

    .current-payable-strip strong {
      font-size: 12px;
    }

  </style>
</head>

<body>
  <main class="invoice-page">

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

          <small>
            MEDICAL / ENGINEERING / FOUNDATIONS / JUNIOR IAS
          </small>
        </div>

      </div>

      <div
        class="document-box ${statusClass}"
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

      <div class="meta-item">
        <span>
          Invoice No
        </span>

        <strong>
          ${this.escapeHtml(
            invoice.invoiceNumber,
          )}
        </strong>
      </div>

      <div class="meta-item">
        <span>
          Invoice Date
        </span>

        <strong>
          ${this.formatDate(
            invoice.invoiceDate,
          )}
        </strong>
      </div>

      <div class="meta-item">
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

      <div class="meta-item">
        <span>
          Status
        </span>

        <strong
          class="${statusClass}"
        >
          ${statusText}
        </strong>
      </div>

    </section>

    <section class="party-section">

      <div class="party-card">

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

      <div class="party-card">

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

        <div class="fee-table-head">
          <div>
            Description
          </div>

          <div>
            Fee Type
          </div>

          <div>
            Total
          </div>

          <div>
            Paid
          </div>

          <div>
            Pending
          </div>
        </div>

        <div class="fee-table-row">

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

          <div>
            ${this.escapeHtml(
              this.formatFeeType(
                fee.feeType,
              ),
            )}
          </div>

          <div>
            Rs. ${this.formatMoney(
              totalFee,
            )}
          </div>

          <div>
            Rs. ${this.formatMoney(
              isReceipt
                ? paidAmount
                : 0,
            )}
          </div>

          <div>
            Rs. ${this.formatMoney(
              isReceipt
                ? pendingAmount
                : totalFee,
            )}
          </div>

        </div>

      </div>

      ${receiptPaymentMeta}

      ${monthlyScheduleHtml}

      ${partialHistoryHtml}

    </section>

    ${bottomSection}

    <footer class="invoice-footer">

      <div>

        <strong>
          ${this.escapeHtml(
            business.invoiceFooter ||
              'Heart full Thanks from SK LEARNINGS',
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
            1,

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