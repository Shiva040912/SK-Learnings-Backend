import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Student,
  StudentSchema,
} from './students.schema';

import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Student.name,
        schema: StudentSchema,
      },
    ]),
  ],

  controllers: [
    StudentsController,
  ],

  providers: [
    StudentsService,
  ],

  exports: [
    StudentsService,
  ],
})
export class StudentsModule {}