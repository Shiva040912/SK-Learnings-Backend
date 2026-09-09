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

import { User, UserDocument } from './user.schema';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PAGE_KEYS } from '../auth/page-keys';
import {
  normalizeGranularPermissions,
  normalizeStudentActions,
  normalizeStudentFields,
} from '../auth/student-permission-keys';
import {
  normalizePaymentActions,
  normalizePaymentFields,
  normalizePaymentUpiFields,
} from '../auth/payment-permission-keys';
import {
  normalizeNotificationActions,
  normalizeNotificationFields,
} from '../auth/notification-permission-keys';
import {
  normalizeInvoiceActions,
  normalizeInvoiceFields,
} from '../auth/invoice-permission-keys';
import { normalizeSettingsActions } from '../auth/settings-permission-keys';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findByEmail(email: string) {
    return this.userModel.findOne({
      email: email.toLowerCase().trim(),
    });
  }

  async createUser(createUserDto: CreateUserDto) {
    const email = createUserDto.email.toLowerCase().trim();

    const existingUser = await this.userModel.findOne({
      email,
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = new this.userModel({
      name: createUserDto.name.trim(),

      email,

      phone: createUserDto.phone?.trim() || '',

      profileImage: createUserDto.profileImage?.trim() || '',

      password: hashedPassword,

      role: createUserDto.role,

      isActive: true,

      pagePermissions: createUserDto.pagePermissions || {},

      granularPermissions: normalizeGranularPermissions(
        createUserDto.granularPermissions,
      ),
    });

    const savedUser = await user.save();

    return {
      message: 'User created successfully',

      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        phone: savedUser.phone || '',
        profileImage: savedUser.profileImage || '',
        role: savedUser.role,
        pagePermissions: savedUser.pagePermissions,
        granularPermissions: savedUser.granularPermissions,
      },
    };
  }

  async getAllUsers() {
    const users = await this.userModel.find().select('-password').lean();

    return users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      profileImage: user.profileImage || '',
      role: user.role,
      pagePermissions: user.pagePermissions,
      granularPermissions: normalizeGranularPermissions(
        user.granularPermissions,
      ),
    }));
  }

  async getUserById(id: string) {
    const user = await this.userModel.findById(id).select('-password').lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      profileImage: user.profileImage || '',
      role: user.role,
      pagePermissions: user.pagePermissions,
      granularPermissions: normalizeGranularPermissions(
        user.granularPermissions,
      ),
    };
  }

  async getMyProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      profileImage: user.profileImage || '',
      role: user.role,
      pagePermissions: user.pagePermissions,
      granularPermissions: normalizeGranularPermissions(
        user.granularPermissions,
      ),
    };
  }

  async updateMyProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateProfileDto.email) {
      const email = updateProfileDto.email.toLowerCase().trim();

      const existingUser = await this.userModel.findOne({
        email,
        _id: {
          $ne: userId,
        },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      user.email = email;
    }

    if (updateProfileDto.name !== undefined) {
      const name = updateProfileDto.name.trim();

      if (!name) {
        throw new BadRequestException('Name cannot be empty');
      }

      user.name = name;
    }

    if (updateProfileDto.phone !== undefined) {
      user.phone = updateProfileDto.phone.trim();
    }

    if (updateProfileDto.profileImage !== undefined) {
      user.profileImage = updateProfileDto.profileImage.trim();
    }

    const updatedUser = await user.save();

    return {
      message: 'Profile updated successfully',

      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || '',
        profileImage: updatedUser.profileImage || '',
        role: updatedUser.role,
        pagePermissions: updatedUser.pagePermissions,
        granularPermissions: normalizeGranularPermissions(
          updatedUser.granularPermissions,
        ),
      },
    };
  }

  async changeMyPassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      user.password,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    user.password = await bcrypt.hash(changePasswordDto.newPassword, 10);

    await user.save();

    return {
      message: 'Password changed successfully',
    };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.email) {
      const email = updateUserDto.email.toLowerCase().trim();

      const existingUser = await this.userModel.findOne({
        email,
        _id: {
          $ne: id,
        },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      user.email = email;
    }

    if (updateUserDto.name) {
      user.name = updateUserDto.name.trim();
    }

    if (updateUserDto.phone !== undefined) {
      user.phone = updateUserDto.phone.trim();
    }

    if (updateUserDto.profileImage !== undefined) {
      user.profileImage = updateUserDto.profileImage.trim();
    }

    if (updateUserDto.role) {
      user.role = updateUserDto.role;
    }

    if (updateUserDto.pagePermissions) {
      for (const key of PAGE_KEYS) {
        const value = updateUserDto.pagePermissions[key];

        if (value !== undefined) {
          user.pagePermissions[key] = value;
        }
      }
    }

    if (updateUserDto.granularPermissions) {
      // Always re-derive from the FULL merged actions map (existing + this
      // update's changes), never from the incoming payload alone — this is
      // what keeps `bulkUpload` pinned to `add` regardless of what a
      // malicious or stale client sends.
      //
      // `user.granularPermissions.students` is a live Mongoose subdocument
      // here (this `user` came from `findById`, not `.lean()`) — it must be
      // resolved through normalizeStudentActions/Fields (which read via
      // property access) before being spread, since spreading a Mongoose
      // (sub)document directly only copies its internal bookkeeping
      // properties, not the actual schema field values.
      const merged = normalizeGranularPermissions({
        students: {
          actions: {
            ...normalizeStudentActions(
              user.granularPermissions?.students?.actions,
            ),
            ...updateUserDto.granularPermissions.students?.actions,
          },
          fields: {
            ...normalizeStudentFields(
              user.granularPermissions?.students?.fields,
            ),
            ...updateUserDto.granularPermissions.students?.fields,
          },
        },
        payments: {
          actions: {
            ...normalizePaymentActions(
              user.granularPermissions?.payments?.actions,
            ),
            ...updateUserDto.granularPermissions.payments?.actions,
          },
          fields: {
            ...normalizePaymentFields(
              user.granularPermissions?.payments?.fields,
            ),
            ...updateUserDto.granularPermissions.payments?.fields,
          },
          upiSettings: {
            ...normalizePaymentUpiFields(
              user.granularPermissions?.payments?.upiSettings,
            ),
            ...updateUserDto.granularPermissions.payments?.upiSettings,
          },
        },
        notifications: {
          actions: {
            ...normalizeNotificationActions(
              user.granularPermissions?.notifications?.actions,
            ),
            ...updateUserDto.granularPermissions.notifications?.actions,
          },
          fields: {
            ...normalizeNotificationFields(
              user.granularPermissions?.notifications?.fields,
            ),
            ...updateUserDto.granularPermissions.notifications?.fields,
          },
        },
        invoices: {
          actions: {
            ...normalizeInvoiceActions(
              user.granularPermissions?.invoices?.actions,
            ),
            ...updateUserDto.granularPermissions.invoices?.actions,
          },
          fields: {
            ...normalizeInvoiceFields(
              user.granularPermissions?.invoices?.fields,
            ),
            ...updateUserDto.granularPermissions.invoices?.fields,
          },
        },
        settings: {
          actions: {
            ...normalizeSettingsActions(
              user.granularPermissions?.settings?.actions,
            ),
            ...updateUserDto.granularPermissions.settings?.actions,
          },
        },
      });

      user.granularPermissions.students = merged.students;
      user.granularPermissions.payments = merged.payments;
      user.granularPermissions.notifications = merged.notifications;
      user.granularPermissions.invoices = merged.invoices;
      user.granularPermissions.settings = merged.settings;
    }

    if (updateUserDto.password) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updatedUser = await user.save();

    return {
      message: 'User updated successfully',

      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || '',
        profileImage: updatedUser.profileImage || '',
        role: updatedUser.role,
        pagePermissions: updatedUser.pagePermissions,
        granularPermissions: normalizeGranularPermissions(
          updatedUser.granularPermissions,
        ),
      },
    };
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userModel.deleteOne({
      _id: id,
    });

    return {
      message: 'User deleted successfully',
    };
  }
}
