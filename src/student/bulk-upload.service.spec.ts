import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { StudentsBulkUploadService } from './bulk-upload.service';
import { Student } from './students.schema';
import { Course } from '../academic/course.schema';
import { Batch } from '../academic/batch.schema';

type SavedDoc = Record<string, unknown> & { _id: string; save: jest.Mock };

interface StudentModelStatics {
  find: jest.Mock;
}

type StudentModelCtor = StudentModelStatics & {
  new (data: Record<string, unknown>): SavedDoc;
};

interface LeanQuery {
  lean: jest.Mock;
}

// C3 (bulk student import per-row error handling) regression coverage for
// the actual commit step (importRows) — each row is independently
// validated/imported, a bad row never blocks the rest, and the response
// reports an accurate imported/failed count with row-level reasons.
describe('StudentsBulkUploadService.importRows (C3)', () => {
  let service: StudentsBulkUploadService;
  let studentModel: StudentModelCtor;
  let courseModel: { find: jest.Mock };
  let batchModel: { find: jest.Mock };
  let savedStudents: Record<string, unknown>[];

  const EXISTING_STUDENTS: Record<string, unknown>[] = [];

  const validRow = (overrides: Record<string, unknown> = {}) => ({
    rowNumber: 2,
    studentName: 'Asha Kumar',
    rollNo: 'R-100',
    parentName: 'Ramesh Kumar',
    dateOfBirth: '2005-01-01',
    gender: 'female',
    phone: '9876543210',
    alternatePhone: '',
    email: '',
    course: 'Science',
    idproof: '123456789012',
    batch: '',
    schoolName: '',
    address: '',
    ...overrides,
  });

  beforeEach(async () => {
    savedStudents = [];

    function MockStudentModel(this: SavedDoc, data: Record<string, unknown>) {
      Object.assign(this, data);
      this._id = `student-${savedStudents.length + 1}`;
      this.save = jest.fn().mockImplementation(async () => {
        savedStudents.push({ ...data, _id: this._id });
        return this;
      });
    }

    const findQuery: LeanQuery = {
      lean: jest.fn().mockResolvedValue(EXISTING_STUDENTS),
    };
    (MockStudentModel as unknown as StudentModelStatics).find = jest
      .fn()
      .mockReturnValue({ select: jest.fn().mockReturnValue(findQuery) });

    studentModel = MockStudentModel as unknown as StudentModelCtor;

    courseModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ courseName: 'Science' }]),
      }),
    };

    batchModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { batchName: 'Morning', startTime: '9:00 AM', endTime: '11:00 AM' },
        ]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsBulkUploadService,
        { provide: getModelToken(Student.name), useValue: studentModel },
        { provide: getModelToken(Course.name), useValue: courseModel },
        { provide: getModelToken(Batch.name), useValue: batchModel },
      ],
    }).compile();

    service = module.get<StudentsBulkUploadService>(StudentsBulkUploadService);
  });

  it('imports all rows when every row is valid', async () => {
    const rows = [
      validRow({ rowNumber: 2, rollNo: 'R-100', idproof: '111122223333' }),
      validRow({ rowNumber: 3, rollNo: 'R-101', idproof: '222233334444' }),
    ];

    const result = await service.importRows(rows);

    expect(result.totalSubmitted).toBe(2);
    expect(result.importedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(savedStudents).toHaveLength(2);
    expect(result.results.every((r) => r.status === 'imported')).toBe(true);
  });

  it('imports valid rows and reports failed rows independently in a mixed batch', async () => {
    const rows = [
      validRow({ rowNumber: 2, rollNo: 'R-200', idproof: '111122223334' }),
      validRow({
        rowNumber: 3,
        rollNo: 'R-201',
        idproof: '222233334445',
        studentName: '',
      }), // missing required field
      validRow({ rowNumber: 4, rollNo: 'R-202', idproof: '333344445556' }),
    ];

    const result = await service.importRows(rows);

    expect(result.totalSubmitted).toBe(3);
    expect(result.importedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(savedStudents).toHaveLength(2);

    const failed = result.results.find((r) => r.rowNumber === 3);
    expect(failed?.status).toBe('failed');
    expect(failed?.reason).toContain('Student Name is required');
  });

  it('reports a row-specific error for an invalid Course', async () => {
    const rows = [
      validRow({ rowNumber: 2, course: 'Not A Real Course' }),
    ];

    const result = await service.importRows(rows);

    expect(result.importedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.results[0].rowNumber).toBe(2);
    expect(result.results[0].reason).toContain(
      'Course "Not A Real Course" is not set up yet',
    );
  });

  it('reports a row-specific error for an invalid Batch', async () => {
    const rows = [
      validRow({ rowNumber: 2, batch: 'Not A Real Batch' }),
    ];

    const result = await service.importRows(rows);

    expect(result.importedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.results[0].reason).toContain(
      'Batch "Not A Real Batch" is not set up yet',
    );
  });

  it('reports a row-specific error for a duplicate student (roll number already exists)', async () => {
    EXISTING_STUDENTS.push({
      rollNo: 'R-100',
      idproof: '999988887777',
      email: '',
      phone: '90000 00000',
      alternatePhone: '',
      parentName: 'Someone Else',
    });

    const rows = [validRow({ rowNumber: 2, rollNo: 'R-100' })];

    const result = await service.importRows(rows);

    expect(result.importedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.results[0].reason).toContain('Roll number already exists');

    EXISTING_STUDENTS.length = 0;
  });

  it('reports a row-specific error for a duplicate roll number within the same file', async () => {
    const rows = [
      validRow({ rowNumber: 2, rollNo: 'R-300', idproof: '111100002222' }),
      validRow({ rowNumber: 3, rollNo: 'R-300', idproof: '333300004444' }),
    ];

    const result = await service.importRows(rows);

    expect(result.importedCount).toBe(1);
    expect(result.failedCount).toBe(1);

    const importedRow = result.results.find((r) => r.rowNumber === 2);
    const failedRow = result.results.find((r) => r.rowNumber === 3);
    expect(importedRow?.status).toBe('imported');
    // Row 1 is committed before row 2 is checked, so row 2 sees R-300 as
    // an already-existing roll number (same outcome as a true DB
    // duplicate) — still row-specific and correctly rejected either way.
    expect(failedRow?.status).toBe('failed');
    expect(failedRow?.reason).toContain('Roll number already exists');
  });

  it('reports a row-specific error for a missing required field', async () => {
    const rows = [validRow({ rowNumber: 2, phone: '' })];

    const result = await service.importRows(rows);

    expect(result.importedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.results[0].reason).toContain('Phone is required');
  });

  it('computes failedCount correctly (not hardcoded to 0) across a larger mixed batch', async () => {
    const rows = [
      validRow({ rowNumber: 2, rollNo: 'R-400', idproof: '400040004000' }),
      validRow({ rowNumber: 3, rollNo: 'R-401', idproof: '' }), // missing idproof
      validRow({ rowNumber: 4, rollNo: 'R-402', course: 'Bogus' }), // invalid course
      validRow({ rowNumber: 5, rollNo: 'R-403', idproof: '400340034003' }),
    ];

    const result = await service.importRows(rows);

    expect(result.totalSubmitted).toBe(4);
    expect(result.importedCount).toBe(2);
    expect(result.failedCount).toBe(2);
    expect(result.importedCount + result.failedCount).toBe(
      result.totalSubmitted,
    );
  });
});
