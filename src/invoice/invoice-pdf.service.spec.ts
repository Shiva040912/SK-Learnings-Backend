// invoice-pdf.service.ts statically imports the `puppeteer` package (an
// ESM-only build Jest's default CJS transform can't parse) purely for
// generatePdfBuffer, which this test never calls — buildHtml is pure
// string construction. Stubbing the module avoids pulling that in.
jest.mock('puppeteer', () => ({}));

import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceDocument } from './invoice.schema';

// C4 (invoice PDF business.qrCode HTML/JS injection) regression coverage:
// business.qrCode must never become executable/breaking HTML in the
// generated invoice document, while a genuine QR image (the only shape
// the Settings upload flow ever actually produces) must still render.
describe('InvoicePdfService — business.qrCode injection guard (C4)', () => {
  const service = new InvoicePdfService();

  const buildHtml = (qrCode: unknown): string => {
    const fakeInvoice = {
      invoiceType: 'fee_setup',
      invoiceNumber: 'INV-TEST-0001',
      invoiceDate: new Date('2026-01-01'),
      dueDate: new Date('2026-01-10'),
      paymentDate: null,
      invoiceAmount: 1000,
      paidAmount: 0,
      pendingAmount: 1000,
      paymentStatus: 'unpaid',
      paymentMethod: undefined,
      student: {
        studentName: 'Test Student',
        rollNo: 'ROLL-1',
        course: 'Test Course',
        batch: '',
        parentName: 'Test Parent',
        phone: '9876543210',
      },
      business: {
        ownerName: 'Owner',
        gstNumber: '',
        address: '',
        qrCode,
        invoiceFooter: '',
        invoiceTerms: '',
      },
      fee: {
        totalFee: 1000,
        feeType: 'partial',
      },
    } as unknown as InvoiceDocument;

    // buildHtml is private — called directly here rather than through the
    // full Puppeteer pipeline, so this stays a fast, deterministic test of
    // exactly the HTML-construction logic that was vulnerable.
    return (service as unknown as { buildHtml: (i: InvoiceDocument) => string })
      .buildHtml(fakeInvoice);
  };

  it('a script-tag payload never appears as live HTML in the output', () => {
    const html = buildHtml('<script>alert(document.cookie)</script>');

    expect(html).not.toContain('<script>alert(document.cookie)</script>');
    expect(html).toContain('QR not configured');
  });

  it('an attribute-breakout payload cannot inject a new attribute/element', () => {
    const html = buildHtml('x.png" onerror="alert(1)" data-x="');

    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain('QR not configured');
  });

  it('a javascript: URI is rejected, not embedded as the image src', () => {
    const html = buildHtml('javascript:alert(1)');

    expect(html).not.toContain('src="javascript:alert(1)"');
    expect(html).toContain('QR not configured');
  });

  it('an arbitrary http(s) URL is rejected (only data:image is trusted)', () => {
    const html = buildHtml('https://evil.example.com/tracker.png');

    expect(html).not.toContain('src="https://evil.example.com/tracker.png"');
    expect(html).toContain('QR not configured');
  });

  it('a genuine data:image QR code (the real upload flow output) still renders', () => {
    const legit = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    const html = buildHtml(legit);

    expect(html).toContain(`<img\n            src="${legit}"`);
    expect(html).not.toContain('QR not configured');
  });

  it('an empty/missing qrCode falls back to the "not configured" placeholder as before', () => {
    const html = buildHtml('');

    expect(html).toContain('QR not configured');
  });
});
