import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AcademicService } from './academic.service';

import { CreateCourseDto } from './dto/create-course.dto';

import { CreateBatchDto } from './dto/create-batch.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';
import { StudentActionGuard } from '../auth/student-permission.guard';
import { RequireStudentAction } from '../auth/student-permission.decorator';

// Courses/batches are managed from both the Students page (Setup modal) and
// the Settings page (Course & Batch tab) — either page permission is enough,
// this is a shared resource, not a dependency between the two pages. The
// addCourse/deleteCourse/addBatch/deleteBatch actions only narrow the
// Students-page path further — a user reaching these routes via Settings
// page access is unaffected (Settings has no granular permissions yet); see
// StudentActionGuard's COURSE_BATCH_ACTIONS bypass.
@Controller('academic')
@UseGuards(JwtAuthGuard, PagePermissionGuard, StudentActionGuard)
@RequirePage('students', 'settings')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @RequireStudentAction('addCourse')
  @Post('courses')
  createCourse(
    @Body()
    createCourseDto: CreateCourseDto,
  ) {
    return this.academicService.createCourse(createCourseDto);
  }

  @Get('courses')
  getCourses() {
    return this.academicService.getCourses();
  }

  @RequireStudentAction('deleteCourse')
  @Delete('courses/:id')
  deleteCourse(
    @Param('id')
    id: string,
  ) {
    return this.academicService.deleteCourse(id);
  }

  @RequireStudentAction('addBatch')
  @Post('batches')
  createBatch(
    @Body()
    createBatchDto: CreateBatchDto,
  ) {
    return this.academicService.createBatch(createBatchDto);
  }

  @Get('batches')
  getBatches() {
    return this.academicService.getBatches();
  }

  @RequireStudentAction('deleteBatch')
  @Delete('batches/:id')
  deleteBatch(
    @Param('id')
    id: string,
  ) {
    return this.academicService.deleteBatch(id);
  }
}
