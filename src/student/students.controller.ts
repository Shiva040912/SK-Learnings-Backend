import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
  ) {}

  /*
   * PUBLIC PAYMENT LINK TRACKING
   */

  @Post(
    'public/:id/payment-link-click',
  )
  trackPaymentLinkClick(
    @Param('id')
    id: string,
  ) {
    return this.studentsService
      .trackPaymentLinkClick(id);
  }

  /*
   * ADMIN ROUTES
   */

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body()
    createStudentDto: CreateStudentDto,
  ) {
    return this.studentsService.create(
      createStudentDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.studentsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    updateStudentDto: UpdateStudentDto,
  ) {
    return this.studentsService.update(
      id,
      updateStudentDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.studentsService.remove(id);
  }
}