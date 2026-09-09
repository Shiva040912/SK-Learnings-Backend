import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Student, StudentSchema } from './students.schema';

import { Course, CourseSchema } from '../academic/course.schema';
import { Batch, BatchSchema } from '../academic/batch.schema';

import { StudentsService } from './students.service';
import { StudentsBulkUploadService } from './bulk-upload.service';
import { StudentsController } from './students.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Student.name,
        schema: StudentSchema,
      },
      {
        name: Course.name,
        schema: CourseSchema,
      },
      {
        name: Batch.name,
        schema: BatchSchema,
      },
    ]),
  ],

  controllers: [StudentsController],

  providers: [StudentsService, StudentsBulkUploadService],

  exports: [StudentsService],
})
export class StudentsModule {}
