import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import {
  User,
  UserDocument,
} from './user.schema';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel:
      Model<UserDocument>,
  ) {}

  async findByEmail(
    email: string,
  ) {
    return this.userModel.findOne({
      email: email
        .toLowerCase()
        .trim(),
    });
  }

  async createUser(
    createUserDto: CreateUserDto,
  ) {
    const email =
      createUserDto.email
        .toLowerCase()
        .trim();

    const existingUser =
      await this.userModel.findOne({
        email,
      });

    if (existingUser) {
      throw new ConflictException(
        'Email already exists',
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        createUserDto.password,
        10,
      );

    const user =
      new this.userModel({
        name:
          createUserDto.name.trim(),

        email,

        phone:
          createUserDto.phone
            ?.trim() || '',

        profileImage:
          createUserDto.profileImage
            ?.trim() || '',

        password:
          hashedPassword,

        role:
          createUserDto.role,

        isActive: true,
      });

    const savedUser =
      await user.save();

    return {
      message:
        'User created successfully',

      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        phone:
          savedUser.phone || '',
        profileImage:
          savedUser.profileImage || '',
        role: savedUser.role,
      },
    };
  }

  async getAllUsers() {
    const users =
      await this.userModel
        .find()
        .select('-password')
        .lean();

    return users.map(
      (user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        phone:
          user.phone || '',
        profileImage:
          user.profileImage || '',
        role: user.role,
      }),
    );
  }

  async getUserById(
    id: string,
  ) {
    const user =
      await this.userModel
        .findById(id)
        .select('-password')
        .lean();

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone:
        user.phone || '',
      profileImage:
        user.profileImage || '',
      role: user.role,
    };
  }

  async getMyProfile(
    userId: string,
  ) {
    const user =
      await this.userModel
        .findById(userId)
        .select('-password')
        .lean();

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone:
        user.phone || '',
      profileImage:
        user.profileImage || '',
      role: user.role,
    };
  }

  async updateMyProfile(
    userId: string,
    updateProfileDto:
      UpdateProfileDto,
  ) {
    const user =
      await this.userModel.findById(
        userId,
      );

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    if (
      updateProfileDto.email
    ) {
      const email =
        updateProfileDto.email
          .toLowerCase()
          .trim();

      const existingUser =
        await this.userModel.findOne({
          email,
          _id: {
            $ne: userId,
          },
        });

      if (existingUser) {
        throw new ConflictException(
          'Email already exists',
        );
      }

      user.email = email;
    }

    if (
      updateProfileDto.name !==
      undefined
    ) {
      const name =
        updateProfileDto.name.trim();

      if (!name) {
        throw new BadRequestException(
          'Name cannot be empty',
        );
      }

      user.name = name;
    }

    if (
      updateProfileDto.phone !==
      undefined
    ) {
      user.phone =
        updateProfileDto.phone.trim();
    }

    if (
      updateProfileDto.profileImage !==
      undefined
    ) {
      user.profileImage =
        updateProfileDto.profileImage.trim();
    }

    const updatedUser =
      await user.save();

    return {
      message:
        'Profile updated successfully',

      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone:
          updatedUser.phone || '',
        profileImage:
          updatedUser.profileImage || '',
        role: updatedUser.role,
      },
    };
  }

  async changeMyPassword(
    userId: string,
    changePasswordDto:
      ChangePasswordDto,
  ) {
    const user =
      await this.userModel.findById(
        userId,
      );

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    const isCurrentPasswordValid =
      await bcrypt.compare(
        changePasswordDto.currentPassword,
        user.password,
      );

    if (
      !isCurrentPasswordValid
    ) {
      throw new UnauthorizedException(
        'Current password is incorrect',
      );
    }

    const isSamePassword =
      await bcrypt.compare(
        changePasswordDto.newPassword,
        user.password,
      );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    user.password =
      await bcrypt.hash(
        changePasswordDto.newPassword,
        10,
      );

    await user.save();

    return {
      message:
        'Password changed successfully',
    };
  }

  async updateUser(
    id: string,
    updateUserDto:
      UpdateUserDto,
  ) {
    const user =
      await this.userModel.findById(
        id,
      );

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    if (
      updateUserDto.email
    ) {
      const email =
        updateUserDto.email
          .toLowerCase()
          .trim();

      const existingUser =
        await this.userModel.findOne({
          email,
          _id: {
            $ne: id,
          },
        });

      if (existingUser) {
        throw new ConflictException(
          'Email already exists',
        );
      }

      user.email = email;
    }

    if (
      updateUserDto.name
    ) {
      user.name =
        updateUserDto.name.trim();
    }

    if (
      updateUserDto.phone !==
      undefined
    ) {
      user.phone =
        updateUserDto.phone.trim();
    }

    if (
      updateUserDto.profileImage !==
      undefined
    ) {
      user.profileImage =
        updateUserDto.profileImage.trim();
    }

    if (
      updateUserDto.role
    ) {
      user.role =
        updateUserDto.role;
    }

    if (
      updateUserDto.password
    ) {
      user.password =
        await bcrypt.hash(
          updateUserDto.password,
          10,
        );
    }

    const updatedUser =
      await user.save();

    return {
      message:
        'User updated successfully',

      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone:
          updatedUser.phone || '',
        profileImage:
          updatedUser.profileImage || '',
        role: updatedUser.role,
      },
    };
  }

  async deleteUser(
    id: string,
  ) {
    const user =
      await this.userModel.findById(
        id,
      );

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    await this.userModel.deleteOne({
      _id: id,
    });

    return {
      message:
        'User deleted successfully',
    };
  }
}