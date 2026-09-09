import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';

import { Student, StudentDocument } from './students.schema';
import { Course, CourseDocument } from '../academic/course.schema';
import { Batch, BatchDocument } from '../academic/batch.schema';

import {
  MAX_BULK_UPLOAD_FILE_SIZE_BYTES,
  MAX_BULK_UPLOAD_ROWS,
} from './bulk-upload.constants';

type RowStatus = 'valid' | 'duplicate' | 'invalid';

interface RowData {
  studentName: string;
  rollNo: string;
  parentName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  alternatePhone: string;
  email: string;
  course: string;
  idproof: string;
  batch: string;
  schoolName: string;
  address: string;
}

export interface PreviewRowResult {
  rowNumber: number;
  status: RowStatus;
  reasons: string[];
  data: RowData;
}

interface ExistingIndex {
  rollNo: Set<string>;
  idproof: Set<string>;
  email: Set<string>;
  phoneToParents: Map<string, Set<string>>;
}

interface BatchState {
  rollNo: Map<string, number>;
  idproof: Map<string, number>;
  email: Map<string, number>;
  phoneOwners: Map<string, { parent: string; rowNumber: number }>;
}

const HEADER_ALIASES: Record<string, string> = {
  studentname: 'studentName',
  name: 'studentName',

  rollno: 'rollNo',
  rollnumber: 'rollNo',

  parentname: 'parentName',
  guardianname: 'parentName',
  parentguardianname: 'parentName',

  dateofbirth: 'dateOfBirth',
  dob: 'dateOfBirth',

  gender: 'gender',

  phone: 'phone',
  parentphone: 'phone',
  mobilenumber: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',

  alternatephone: 'alternatePhone',
  alternatenumber: 'alternatePhone',
  alternativephone: 'alternatePhone',
  alternativenumber: 'alternatePhone',

  email: 'email',
  emailaddress: 'email',

  course: 'course',

  idproof: 'idproof',
  aadhaar: 'idproof',
  aadhaarnumber: 'idproof',
  aadhar: 'idproof',
  aadharnumber: 'idproof',

  batch: 'batch',

  schoolname: 'schoolName',
  school: 'schoolName',

  address: 'address',
  residentialaddress: 'address',
}; // one-to-many mapping so exports from other tools (varying casing/spacing) still resolve to a canonical field

const REQUIRED_FIELDS: (keyof RowData)[] = [
  'studentName',
  'rollNo',
  'parentName',
  'dateOfBirth',
  'gender',
  'phone',
  'course',
  'idproof',
];

const PHONE_PATTERN = /^[6-9]\d{4} \d{5}$/;
const AADHAAR_PATTERN = /^\d{4} \d{4} \d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDER_MAP: Record<string, 'male' | 'female' | 'others'> = {
  male: 'male',
  m: 'male',
  female: 'female',
  f: 'female',
  others: 'others',
  other: 'others',
};

function toRawString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();

  return '';
}

function normalizeHeaderKey(header: unknown): string {
  return toRawString(header)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeParentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

@Injectable()
export class StudentsBulkUploadService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,

    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,

    @InjectModel(Batch.name)
    private readonly batchModel: Model<BatchDocument>,
  ) {}

  async previewFile(file?: Express.Multer.File) {
    if (!file || !file.buffer || !file.buffer.length) {
      throw new BadRequestException('Please select a file to upload');
    }

    if (file.size > MAX_BULK_UPLOAD_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        'File is too large. Maximum allowed size is 5 MB',
      );
    }

    const rawRows = await this.parseFile(file.buffer, file.originalname);

    return this.buildPreview(rawRows);
  }

  async importRows(rows: Record<string, unknown>[]) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('No student rows were provided to import');
    }

    if (rows.length > MAX_BULK_UPLOAD_ROWS) {
      throw new BadRequestException(
        `Cannot import more than ${MAX_BULK_UPLOAD_ROWS} students in a single request`,
      );
    }

    const [courses, batches, existing] = await Promise.all([
      this.courseModel.find().lean(),
      this.batchModel.find().lean(),
      this.loadExistingIndex(),
    ]);

    const batchState: BatchState = {
      rollNo: new Map(),
      idproof: new Map(),
      email: new Map(),
      phoneOwners: new Map(),
    };

    const results: Array<{
      rowNumber: number | null;
      status: 'imported' | 'failed';
      studentName: string;
      rollNo: string;
      studentId?: string;
      reason?: string;
    }> = [];

    let importedCount = 0;

    for (const rawRow of rows) {
      const rowNumber =
        typeof rawRow?.rowNumber === 'number' ? rawRow.rowNumber : null;

      // Every field is re-derived from the raw payload and re-validated here —
      // nothing about a row's earlier "valid" status from /preview is trusted.
      const data = this.buildRowData(rawRow, false);

      const reasons = [
        ...this.validateFormat(data),
        ...this.resolveCourseAndBatch(data, courses, batches),
        ...this.findDuplicateReasons(data, existing, batchState),
      ];

      if (reasons.length > 0) {
        results.push({
          rowNumber,
          status: 'failed',
          studentName: data.studentName,
          rollNo: data.rollNo,
          reason: reasons.join('; '),
        });
        continue;
      }

      const student = new this.studentModel({
        studentName: data.studentName,
        rollNo: data.rollNo,
        parentName: data.parentName,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender,
        phone: data.phone,
        alternatePhone: data.alternatePhone || undefined,
        email: data.email || undefined,
        course: data.course,
        idproof: data.idproof,
        batch: data.batch || undefined,
        schoolName: data.schoolName || undefined,
        address: data.address || undefined,
        totalFee: 0,
        feeSetupCompleted: false,
        monthlyAmount: 0,
        paidMonths: 0,
        paidAmount: 0,
        pendingAmount: 0,
        paymentStatus: 'unpaid',
        isActive: true,
      });

      await student.save();

      this.registerExisting(existing, data);
      this.registerBatchState(
        batchState,
        data,
        rowNumber ?? results.length + 2,
      );

      importedCount += 1;

      results.push({
        rowNumber,
        status: 'imported',
        studentName: data.studentName,
        rollNo: data.rollNo,
        studentId: String(student._id),
      });
    }

    return {
      totalSubmitted: rows.length,
      importedCount,
      failedCount: rows.length - importedCount,
      results,
    };
  }

  private async buildPreview(rawRows: Record<string, unknown>[]) {
    if (rawRows.length === 0) {
      throw new BadRequestException('The uploaded file has no data rows');
    }

    if (rawRows.length > MAX_BULK_UPLOAD_ROWS) {
      throw new BadRequestException(
        `File contains too many rows (max ${MAX_BULK_UPLOAD_ROWS}). Please split it into smaller files.`,
      );
    }

    this.assertRequiredHeaders(rawRows[0]);

    const [courses, batches, existing] = await Promise.all([
      this.courseModel.find().lean(),
      this.batchModel.find().lean(),
      this.loadExistingIndex(),
    ]);

    const batchState: BatchState = {
      rollNo: new Map(),
      idproof: new Map(),
      email: new Map(),
      phoneOwners: new Map(),
    };

    const rows: PreviewRowResult[] = [];

    rawRows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const data = this.buildRowData(rawRow, true);

      if (this.isBlankRow(data)) {
        return;
      }

      const formatReasons = this.validateFormat(data);

      if (formatReasons.length > 0) {
        rows.push({
          rowNumber,
          status: 'invalid',
          reasons: formatReasons,
          data,
        });
        return;
      }

      const refReasons = this.resolveCourseAndBatch(data, courses, batches);

      if (refReasons.length > 0) {
        rows.push({ rowNumber, status: 'invalid', reasons: refReasons, data });
        return;
      }

      const dupReasons = this.findDuplicateReasons(data, existing, batchState);

      if (dupReasons.length > 0) {
        rows.push({
          rowNumber,
          status: 'duplicate',
          reasons: dupReasons,
          data,
        });
        return;
      }

      this.registerBatchState(batchState, data, rowNumber);
      rows.push({ rowNumber, status: 'valid', reasons: [], data });
    });

    const summary = {
      total: rows.length,
      valid: rows.filter((r) => r.status === 'valid').length,
      duplicate: rows.filter((r) => r.status === 'duplicate').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
    };

    return { totalRows: rows.length, summary, rows };
  }

  private async parseFile(
    buffer: Buffer,
    originalName: string,
  ): Promise<Record<string, unknown>[]> {
    const isCsv = /\.csv$/i.test(originalName);
    const isXlsx = /\.xlsx$/i.test(originalName);

    if (!isCsv && !isXlsx) {
      throw new BadRequestException('Only .xlsx or .csv files are allowed');
    }

    try {
      return isCsv
        ? this.parseCsvBuffer(buffer)
        : await this.parseXlsxBuffer(buffer);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Could not read the file. Please make sure it is a valid .xlsx or .csv file.',
      );
    }
  }

  private parseCsvBuffer(buffer: Buffer): Record<string, unknown>[] {
    let text = buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    const records = parseCsv<Record<string, unknown>>(text, {
      columns: (header: string[]) =>
        header.map((cell) => toRawString(cell).trim()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    return records;
  }

  private async parseXlsxBuffer(
    buffer: Buffer,
  ): Promise<Record<string, unknown>[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return [];
    }

    const headers: string[] = [];

    worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber] = toRawString(cell.value).trim();
    });

    const rows: Record<string, unknown>[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const obj: Record<string, unknown> = {};

      headers.forEach((header, colIndex) => {
        if (!header) return;

        obj[header] = this.cellToValue(row.getCell(colIndex));
      });

      if (Object.keys(obj).length > 0) {
        rows.push(obj);
      }
    }

    return rows;
  }

  private cellToValue(cell: ExcelJS.Cell): unknown {
    const value = cell.value;

    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value;

    if (typeof value === 'object') {
      const richText = value as { richText?: { text: string }[] };
      if (Array.isArray(richText.richText)) {
        return richText.richText.map((part) => part.text).join('');
      }

      const formulaResult = value as { result?: unknown };
      if ('result' in formulaResult) return formulaResult.result ?? '';

      const hyperlink = value as { text?: string };
      if ('text' in hyperlink) return hyperlink.text ?? '';

      return toRawString(value);
    }

    return value;
  }

  private assertRequiredHeaders(firstRow: Record<string, unknown>) {
    const presentCanonical = new Set(
      Object.keys(firstRow)
        .map((header) => HEADER_ALIASES[normalizeHeaderKey(header)])
        .filter(Boolean),
    );

    const missing = REQUIRED_FIELDS.filter(
      (field) => !presentCanonical.has(field),
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `The file is missing required column(s): ${missing.join(', ')}. Please use the sample template.`,
      );
    }
  }

  private extractCanonicalFields(
    raw: Record<string, unknown>,
    useHeaderAliases: boolean,
  ): Record<string, unknown> {
    if (!useHeaderAliases) {
      return {
        studentName: raw.studentName,
        rollNo: raw.rollNo,
        parentName: raw.parentName,
        dateOfBirth: raw.dateOfBirth,
        gender: raw.gender,
        phone: raw.phone,
        alternatePhone: raw.alternatePhone,
        email: raw.email,
        course: raw.course,
        idproof: raw.idproof,
        batch: raw.batch,
        schoolName: raw.schoolName,
        address: raw.address,
      };
    }

    const picked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(raw)) {
      const canonical = HEADER_ALIASES[normalizeHeaderKey(key)];

      if (canonical && picked[canonical] === undefined) {
        picked[canonical] = value;
      }
    }

    return picked;
  }

  private buildRowData(
    raw: Record<string, unknown>,
    useHeaderAliases: boolean,
  ): RowData {
    const picked = this.extractCanonicalFields(raw, useHeaderAliases);

    return {
      studentName: this.normalizeText(picked.studentName),
      rollNo: this.normalizeText(picked.rollNo),
      parentName: this.normalizeText(picked.parentName),
      dateOfBirth: this.normalizeDateValue(picked.dateOfBirth),
      gender: this.normalizeGenderValue(picked.gender),
      phone: this.normalizePhoneValue(picked.phone),
      alternatePhone: this.normalizePhoneValue(picked.alternatePhone),
      email: this.normalizeEmailValue(picked.email),
      course: this.normalizeText(picked.course),
      idproof: this.normalizeAadhaarValue(picked.idproof),
      batch: this.normalizeText(picked.batch),
      schoolName: this.normalizeText(picked.schoolName),
      address: this.normalizeText(picked.address),
    };
  }

  private isBlankRow(data: RowData): boolean {
    return (Object.values(data) as string[]).every((value) => !value.trim());
  }

  private normalizeText(value: unknown): string {
    return toRawString(value).trim();
  }

  private normalizePhoneValue(value: unknown): string {
    const raw = toRawString(value);
    const digits = raw.replace(/\D/g, '');

    if (digits.length === 10) {
      return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    }

    return raw.trim();
  }

  private normalizeAadhaarValue(value: unknown): string {
    const raw = toRawString(value);
    const digits = raw.replace(/\D/g, '');

    if (digits.length === 12) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
    }

    return raw.trim();
  }

  private normalizeEmailValue(value: unknown): string {
    return toRawString(value).trim().toLowerCase();
  }

  private normalizeGenderValue(value: unknown): string {
    const key = toRawString(value).trim().toLowerCase();

    return GENDER_MAP[key] || '';
  }

  private normalizeDateValue(value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().split('T')[0];
    }

    const text = toRawString(value).trim();

    if (!text) return '';

    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return this.toIsoDate(Number(year), Number(month), Number(day));
    }

    const slashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return this.toIsoDate(Number(year), Number(month), Number(day));
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return '';
  }

  private toIsoDate(year: number, month: number, day: number): string {
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return '';
    }

    return date.toISOString().split('T')[0];
  }

  private validateFormat(data: RowData): string[] {
    const reasons: string[] = [];

    if (!data.studentName) reasons.push('Student Name is required');
    if (!data.rollNo) reasons.push('Roll No is required');
    if (!data.parentName) reasons.push('Parent Name is required');

    if (!data.dateOfBirth) {
      reasons.push('Date of Birth is required or could not be understood');
    } else {
      const dob = new Date(`${data.dateOfBirth}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (Number.isNaN(dob.getTime()) || dob > today) {
        reasons.push('Date of Birth is invalid or in the future');
      }
    }

    if (!data.gender) {
      reasons.push('Gender must be Male, Female or Others');
    }

    if (!data.phone) {
      reasons.push('Phone is required');
    } else if (!PHONE_PATTERN.test(data.phone)) {
      reasons.push(
        'Phone number must be a 10-digit number starting with 6, 7, 8 or 9',
      );
    }

    if (data.alternatePhone && !PHONE_PATTERN.test(data.alternatePhone)) {
      reasons.push('Alternate phone number is invalid');
    }

    if (
      data.phone &&
      data.alternatePhone &&
      data.phone === data.alternatePhone
    ) {
      reasons.push('Phone and alternate phone cannot be the same');
    }

    if (data.email && !EMAIL_PATTERN.test(data.email)) {
      reasons.push('Email address is invalid');
    }

    if (!data.course) {
      reasons.push('Course is required');
    }

    if (!data.idproof) {
      reasons.push('Aadhaar Number is required');
    } else if (!AADHAAR_PATTERN.test(data.idproof)) {
      reasons.push('Aadhaar Number must be a valid 12-digit number');
    }

    return reasons;
  }

  private resolveCourseAndBatch(
    data: RowData,
    courses: { courseName: string }[],
    batches: { batchName: string; startTime: string; endTime: string }[],
  ): string[] {
    const reasons: string[] = [];

    if (data.course) {
      const match = courses.find(
        (course) =>
          course.courseName.toLowerCase() === data.course.toLowerCase(),
      );

      if (!match) {
        reasons.push(
          `Course "${data.course}" is not set up yet. Add it from Setup before importing.`,
        );
      } else {
        data.course = match.courseName;
      }
    }

    if (data.batch) {
      const inputLower = data.batch.toLowerCase();

      // Accepts either a plain batch name (from an uploaded file) or the
      // full composed label already resolved by an earlier /preview call —
      // Import always re-resolves from scratch, so both forms must match.
      const match = batches.find((batch) => {
        const label = `${batch.batchName} — ${batch.startTime} - ${batch.endTime}`;

        return (
          batch.batchName.toLowerCase() === inputLower ||
          label.toLowerCase() === inputLower
        );
      });

      if (!match) {
        reasons.push(
          `Batch "${data.batch}" is not set up yet. Add it from Setup before importing.`,
        );
      } else {
        data.batch = `${match.batchName} — ${match.startTime} - ${match.endTime}`;
      }
    }

    return reasons;
  }

  private async loadExistingIndex(): Promise<ExistingIndex> {
    const students = await this.studentModel
      .find()
      .select('rollNo idproof email phone alternatePhone parentName')
      .lean();

    const index: ExistingIndex = {
      rollNo: new Set(),
      idproof: new Set(),
      email: new Set(),
      phoneToParents: new Map(),
    };

    for (const student of students) {
      if (student.rollNo) index.rollNo.add(student.rollNo.trim());
      if (student.idproof) index.idproof.add(student.idproof.trim());
      if (student.email) index.email.add(student.email.trim().toLowerCase());

      const parent = normalizeParentName(student.parentName || '');

      for (const number of [student.phone, student.alternatePhone]) {
        if (!number) continue;

        const key = String(number).trim();

        if (!index.phoneToParents.has(key)) {
          index.phoneToParents.set(key, new Set());
        }

        index.phoneToParents.get(key)!.add(parent);
      }
    }

    return index;
  }

  private registerExisting(index: ExistingIndex, data: RowData) {
    index.rollNo.add(data.rollNo);
    index.idproof.add(data.idproof);
    if (data.email) index.email.add(data.email);

    const parent = normalizeParentName(data.parentName);

    for (const number of [data.phone, data.alternatePhone]) {
      if (!number) continue;

      if (!index.phoneToParents.has(number)) {
        index.phoneToParents.set(number, new Set());
      }

      index.phoneToParents.get(number)!.add(parent);
    }
  }

  private registerBatchState(
    state: BatchState,
    data: RowData,
    rowNumber: number,
  ) {
    state.rollNo.set(data.rollNo, rowNumber);
    state.idproof.set(data.idproof, rowNumber);
    if (data.email) state.email.set(data.email, rowNumber);

    const parent = normalizeParentName(data.parentName);

    for (const number of [data.phone, data.alternatePhone]) {
      if (!number) continue;
      if (!state.phoneOwners.has(number)) {
        state.phoneOwners.set(number, { parent, rowNumber });
      }
    }
  }

  private findDuplicateReasons(
    data: RowData,
    index: ExistingIndex,
    batchState: BatchState,
  ): string[] {
    const reasons: string[] = [];
    const parent = normalizeParentName(data.parentName);

    if (index.rollNo.has(data.rollNo)) {
      reasons.push('Roll number already exists');
    } else if (batchState.rollNo.has(data.rollNo)) {
      reasons.push(
        `Duplicate Roll No — already used in row ${batchState.rollNo.get(data.rollNo)} of this file`,
      );
    }

    if (index.idproof.has(data.idproof)) {
      reasons.push('Aadhaar number already exists');
    } else if (batchState.idproof.has(data.idproof)) {
      reasons.push(
        `Duplicate Aadhaar Number — already used in row ${batchState.idproof.get(data.idproof)} of this file`,
      );
    }

    if (data.email) {
      if (index.email.has(data.email)) {
        reasons.push('Email ID already exists');
      } else if (batchState.email.has(data.email)) {
        reasons.push(
          `Duplicate Email — already used in row ${batchState.email.get(data.email)} of this file`,
        );
      }
    }

    const phoneFields: [string, string][] = [
      ['Phone', data.phone],
      ['Alternate phone', data.alternatePhone],
    ];

    for (const [label, number] of phoneFields) {
      if (!number) continue;

      const dbParents = index.phoneToParents.get(number);

      if (dbParents && !dbParents.has(parent)) {
        reasons.push(
          `${label} number is already registered with another parent`,
        );
        continue;
      }

      const owner = batchState.phoneOwners.get(number);

      if (owner && owner.parent !== parent) {
        reasons.push(
          `${label} number is already used by a different parent in row ${owner.rowNumber} of this file`,
        );
      }
    }

    return reasons;
  }
}
