import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { UsersService } from './users.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Post('create-admin')
  createAdmin(
    @Body()
    createUserDto: CreateUserDto,
  ) {
    return this.usersService.createUser(
      createUserDto,
    );
  }

  @Get()
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get(':id')
  getUserById(
    @Param('id') id: string,
  ) {
    return this.usersService.getUserById(
      id,
    );
  }

  @Patch(':id')
  updateUser(
    @Param('id') id: string,

    @Body()
    updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(
      id,
      updateUserDto,
    );
  }

  @Delete(':id')
  deleteUser(
    @Param('id') id: string,
  ) {
    return this.usersService.deleteUser(
      id,
    );
  }
}