// invoice-pdf.service.ts statically imports the ESM-only `puppeteer`
// package — stub it with a controllable `launch` so generatePdfBuffer's
// resource-management path (the thing under test here) can actually run.
jest.mock('puppeteer', () => ({ launch: jest.fn() }));

import puppeteer from 'puppeteer';

import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceDocument } from './invoice.schema';

type MockPage = {
  setViewport: jest.Mock;
  setContent: jest.Mock;
  emulateMediaType: jest.Mock;
  pdf: jest.Mock;
};

type MockBrowser = {
  newPage: jest.Mock<Promise<MockPage>, []>;
  close: jest.Mock<Promise<void>, []>;
};

// H9 (Puppeteer/Chrome resource risk) regression coverage: every launch
// must be reliably closed (even on failure) and concurrent generations
// must not be able to spawn unbounded Chrome instances.
describe('InvoicePdfService — Puppeteer resource management (H9)', () => {
  let service: InvoicePdfService;
  let launchMock: jest.Mock;
  let activeBrowsers: number;
  let maxObservedConcurrency: number;
  let closeCalls: number;

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
      qrCode: '',
      invoiceFooter: '',
      invoiceTerms: '',
    },
    fee: {
      totalFee: 1000,
      feeType: 'partial',
    },
  } as unknown as InvoiceDocument;

  const makeBrowser = (opts: { failOnPdf?: boolean } = {}): MockBrowser => {
    const page: MockPage = {
      setViewport: jest.fn().mockResolvedValue(undefined),
      setContent: jest.fn().mockResolvedValue(undefined),
      emulateMediaType: jest.fn().mockResolvedValue(undefined),
      pdf: opts.failOnPdf
        ? jest.fn().mockRejectedValue(new Error('render failed'))
        : jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    };

    return {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockImplementation(async () => {
        activeBrowsers -= 1;
        closeCalls += 1;
      }),
    };
  };

  beforeEach(() => {
    service = new InvoicePdfService();
    activeBrowsers = 0;
    maxObservedConcurrency = 0;
    closeCalls = 0;

    launchMock = (puppeteer as unknown as { launch: jest.Mock }).launch;
    launchMock.mockReset();
    launchMock.mockImplementation(async () => {
      activeBrowsers += 1;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, activeBrowsers);
      // Yield so genuinely-concurrent calls actually interleave here
      // instead of running launch-to-close back to back.
      await new Promise((resolve) => setImmediate(resolve));
      return makeBrowser();
    });
  });

  it('generates a normal invoice PDF and closes the browser it launched', async () => {
    const buffer = await service.generatePdfBuffer(fakeInvoice);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(closeCalls).toBe(1);
  });

  it('caps concurrent Chrome launches under a burst of simultaneous requests, with no leaks', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.generatePdfBuffer(fakeInvoice)),
    );

    expect(results).toHaveLength(5);
    results.forEach((buf) => expect(buf).toBeInstanceOf(Buffer));

    expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
    expect(launchMock).toHaveBeenCalledTimes(5);
    // Every launch was matched by a close — no leaked browser processes.
    expect(closeCalls).toBe(5);
  });

  it('closes the browser and frees its concurrency slot even when PDF rendering fails', async () => {
    launchMock.mockImplementationOnce(async () => {
      activeBrowsers += 1;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, activeBrowsers);
      return makeBrowser({ failOnPdf: true });
    });

    await expect(service.generatePdfBuffer(fakeInvoice)).rejects.toThrow(
      'Unable to generate invoice PDF',
    );

    expect(closeCalls).toBe(1);

    // The failed generation's concurrency slot must have been released —
    // a subsequent generation should still complete, not hang forever.
    const buffer = await service.generatePdfBuffer(fakeInvoice);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(closeCalls).toBe(2);
  });
});
