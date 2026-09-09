import { ArrayMaxSize, ArrayNotEmpty, IsArray } from 'class-validator';

import { MAX_BULK_UPLOAD_ROWS } from '../bulk-upload.constants';

export class ImportStudentsDto {
  @IsArray()
  @ArrayNotEmpty({
    message: 'No student rows were provided to import',
  })
  @ArrayMaxSize(MAX_BULK_UPLOAD_ROWS, {
    message: `Cannot import more than ${MAX_BULK_UPLOAD_ROWS} students in a single request`,
  })
  rows!: Record<string, unknown>[];
}
