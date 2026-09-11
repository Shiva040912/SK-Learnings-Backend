import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UsersService } from './users.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';

interface RequestWithUser {
  user?: {
    role: string;
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // me/profile and me/password are every user's own account settings — not
  // the admin-facing Users page — so they stay accessible to any logged-in
  // user regardless of their "users" page permission.

  @Get('me/profile')
  getMyProfile(@Req() req: any) {
    return this.usersService.getMyProfile(req.user.userId);
  }

  @Patch('me/profile')
  updateMyProfile(
    @Req() req: any,

    @Body()
    updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateMyProfile(req.user.userId, updateProfileDto);
  }

  @Patch('me/password')
  changeMyPassword(
    @Req() req: any,

    @Body()
    changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changeMyPassword(
      req.user.userId,
      changePasswordDto,
    );
  }

  @Post('create-admin')
  @UseGuards(PagePermissionGuard)
  @RequirePage('users')
  createAdmin(
    @Req() req: RequestWithUser,

    @Body()
    createUserDto: CreateUserDto,
  ) {
    return this.usersService.createUser(createUserDto, req.user);
  }

  @Get()
  @UseGuards(PagePermissionGuard)
  @RequirePage('users')
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get(':id')
  @UseGuards(PagePermissionGuard)
  @RequirePage('users')
  getUserById(
    @Param('id')
    id: string,
  ) {
    return this.usersService.getUserById(id);
  }

  @Patch(':id')
  @UseGuards(PagePermissionGuard)
  @RequirePage('users')
  updateUser(
    @Req() req: RequestWithUser,

    @Param('id')
    id: string,

    @Body()
    updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto, req.user);
  }

  @Delete(':id')
  @UseGuards(PagePermissionGuard)
  @RequirePage('users')
  deleteUser(
    @Req() req: RequestWithUser,

    @Param('id')
    id: string,
  ) {
    return this.usersService.deleteUser(id, req.user);
  }
}
