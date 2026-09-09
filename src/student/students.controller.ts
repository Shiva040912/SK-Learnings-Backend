import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { StudentsService } from './students.service';
import { StudentsBulkUploadService } from './bulk-upload.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ImportStudentsDto } from './dto/bulk-import-students.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';
import { StudentActionGuard } from '../auth/student-permission.guard';
import { RequireStudentAction } from '../auth/student-permission.decorator';
import { MAX_BULK_UPLOAD_FILE_SIZE_BYTES } from './bulk-upload.constants';
import {
  redactStudentForUser,
  redactStudentListForUser,
} from './student-field-redaction.util';
import { redactStudentListForPaymentsUser } from '../payments/payment-field-redaction.util';
import { GranularPermissionsMap } from '../auth/student-permission-keys';

interface RequestWithUser {
  user?: {
    role: string;
    granularPermissions?: GranularPermissionsMap;
    pagePermissions?: { students?: boolean; payments?: boolean };
  };
}

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly bulkUploadService: StudentsBulkUploadService,
  ) {}

  /*
   * PUBLIC PAYMENT LINK TRACKING
   */

  @Post('public/:id/payment-link-click')
  trackPaymentLinkClick(
    @Param('id')
    id: string,
  ) {
    return this.studentsService.trackPaymentLinkClick(id);
  }

  /*
   * ADMIN ROUTES
   */

  @UseGuards(JwtAuthGuard, PagePermissionGuard, StudentActionGuard)
  @RequirePage('students')
  @RequireStudentAction('add')
  @Post()
  create(
    @Body()
    createStudentDto: CreateStudentDto,
  ) {
    return this.studentsService.create(createStudentDto);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, StudentActionGuard)
  @RequirePage('students')
  @RequireStudentAction('bulkUpload')
  @Post('bulk-upload/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_BULK_UPLOAD_FILE_SIZE_BYTES,
      },
      fileFilter: (_req, file, callback) => {
        if (!/\.(xlsx|csv)$/i.test(file.originalname)) {
          callback(
            new BadRequestException('Only .xlsx or .csv files are allowed'),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  previewBulkUpload(
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return this.bulkUploadService.previewFile(file);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, StudentActionGuard)
  @RequirePage('students')
  @RequireStudentAction('bulkUpload')
  @Post('bulk-upload/import')
  importBulkUpload(
    @Body()
    importStudentsDto: ImportStudentsDto,
  ) {
    return this.bulkUploadService.importRows(importStudentsDto.rows);
  }

  // Also reachable via the Payments page, which fetches this same list to
  // build its fee-management table — see StudentActionGuard's view bypass.
  // The Payments page passes ?context=payments so this handler can apply
  // Payments' own (independent) Fields permissions instead of the Students
  // page's, without the two pages' field choices ever affecting each other.
  @UseGuards(JwtAuthGuard, PagePermissionGuard, StudentActionGuard)
  @RequirePage('students', 'payments')
  @RequireStudentAction('view')
  @Get()
  async findAll(
    @Req()
    request: RequestWithUser,

    @Query('context')
    context?: string,
  ) {
    const students = await this.studentsService.findAll();

    const plainStudents = students.map(
      (student) => student.toObject() as unknown as Record<string, unknown>,
    );

    const user = request.user;
    const isAdmin = user?.role === 'admin';
    const hasStudentsAccess =
      isAdmin || user?.pagePermissions?.students === true;
    const hasPaymentsAccess =
      isAdmin || user?.pagePermissions?.payments === true;

    // A user reachable here ONLY via the payments bypass (no Students page
    // access at all) can only ever be viewing this for the Payments page.
    const forcedPaymentsContext =
      !isAdmin && !hasStudentsAccess && hasPaymentsAccess;

    if (
      !isAdmin &&
      (forcedPaymentsContext || (context === 'payments' && hasPaymentsAccess))
    ) {
      return redactStudentListForPaymentsUser(plainStudents, user);
    }

    return redactStudentListForUser(plainStudents, user);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, StudentActionGuard)
  @RequirePage('students')
  @RequireStudentAction('view')
  @Get(':id')
  async findOne(
    @Param('id')
    id: string,

    @Req()
    request: RequestWithUser,
  ) {
    const student = await this.studentsService.findOne(id);

    return redactStudentForUser(
      student.toObject() as unknown as Record<string, unknown>,
      request.user,
    );
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, StudentActionGuard)
  @RequirePage('students')
  @RequireStudentAction('edit')
  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    updateStudentDto: UpdateStudentDto,
  ) {
    return this.studentsService.update(id, updateStudentDto);
  }

  @UseGuards(JwtAuthGuard, PagePermissionGuard, StudentActionGuard)
  @RequirePage('students')
  @RequireStudentAction('delete')
  @Delete(':id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.studentsService.remove(id);
  }
}
