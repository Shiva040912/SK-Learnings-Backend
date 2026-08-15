import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  AcademicService,
} from './academic.service';

import {
  CreateCourseDto,
} from './dto/create-course.dto';

import {
  CreateBatchDto,
} from './dto/create-batch.dto';

import {
  JwtAuthGuard,
} from '../auth/jwt-auth.guard';

@Controller('academic')
@UseGuards(JwtAuthGuard)
export class AcademicController {
  constructor(
    private readonly academicService:
      AcademicService,
  ) {}

  @Post('courses')
  createCourse(
    @Body()
    createCourseDto:
      CreateCourseDto,
  ) {
    return this.academicService.createCourse(
      createCourseDto,
    );
  }

  @Get('courses')
  getCourses() {
    return this.academicService.getCourses();
  }

  @Delete('courses/:id')
  deleteCourse(
    @Param('id')
    id: string,
  ) {
    return this.academicService.deleteCourse(
      id,
    );
  }

  @Post('batches')
  createBatch(
    @Body()
    createBatchDto:
      CreateBatchDto,
  ) {
    return this.academicService.createBatch(
      createBatchDto,
    );
  }

  @Get('batches')
  getBatches() {
    return this.academicService.getBatches();
  }

  @Delete('batches/:id')
  deleteBatch(
    @Param('id')
    id: string,
  ) {
    return this.academicService.deleteBatch(
      id,
    );
  }
}