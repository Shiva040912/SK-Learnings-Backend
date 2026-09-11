import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { UsersService } from './users.service';
import { User } from './user.schema';

type SavedDoc = Record<string, unknown> & { save: jest.Mock };

interface UserModelStatics {
  findOne: jest.Mock;
  findById: jest.Mock;
  deleteOne: jest.Mock;
}

type UserModelCtor = UserModelStatics & {
  new (data: Record<string, unknown>): SavedDoc;
};

// C1 (Users privilege escalation) regression coverage: a non-admin must
// never be able to create a user, change role/pagePermissions/
// granularPermissions on any account (including their own), or delete an
// admin account — and a blocked attempt must never touch the database.
describe('UsersService — privilege escalation guard (C1)', () => {
  let service: UsersService;
  let userModel: UserModelCtor;

  const buildUserModel = (): UserModelCtor => {
    function MockUserModel(this: SavedDoc, data: Record<string, unknown>) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue({ ...data, _id: 'new-user-id' });
    }

    const ctor = MockUserModel as unknown as UserModelCtor;
    ctor.findOne = jest.fn();
    ctor.findById = jest.fn();
    ctor.deleteOne = jest.fn();

    return ctor;
  };

  beforeEach(async () => {
    userModel = buildUserModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('createUser', () => {
    const dto = {
      name: 'New Trainer',
      email: 'new-trainer@example.com',
      password: 'password123',
      role: 'trainer' as const,
    };

    it('rejects a non-admin caller without touching the database', async () => {
      await expect(
        service.createUser(dto, { role: 'trainer' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(userModel.findOne).not.toHaveBeenCalled();
    });

    it('rejects when no acting user is supplied', async () => {
      await expect(service.createUser(dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('allows an admin caller to create a user', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.createUser(dto, { role: 'admin' }),
      ).resolves.toMatchObject({ message: 'User created successfully' });
    });
  });

  describe('updateUser', () => {
    let existingUser: SavedDoc;

    beforeEach(() => {
      existingUser = {
        _id: 'target-user-id',
        name: 'Existing User',
        email: 'existing@example.com',
        role: 'trainer',
        pagePermissions: { users: true },
        granularPermissions: {},
        save: jest.fn(),
      };
      existingUser.save = jest.fn().mockResolvedValue({ ...existingUser });
      userModel.findById.mockResolvedValue(existingUser);
    });

    it('rejects a non-admin attempting to change role, and the DB is never read', async () => {
      await expect(
        service.updateUser('target-user-id', { role: 'admin' } as never, {
          role: 'trainer',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(userModel.findById).not.toHaveBeenCalled();
    });

    it('rejects a non-admin attempting to change their own pagePermissions', async () => {
      await expect(
        service.updateUser(
          'target-user-id',
          { pagePermissions: { users: true } },
          { role: 'trainer' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a non-admin attempting to change granularPermissions on another account', async () => {
      await expect(
        service.updateUser(
          'someone-else-id',
          {
            granularPermissions: {
              payments: { actions: { collectPayment: true } },
            },
          },
          { role: 'trainer' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a non-admin to update non-privileged fields', async () => {
      await expect(
        service.updateUser(
          'target-user-id',
          { name: 'Updated Name' },
          { role: 'trainer' },
        ),
      ).resolves.toMatchObject({ message: 'User updated successfully' });

      expect(userModel.findById).toHaveBeenCalled();
    });

    it('allows an admin to change role and permissions', async () => {
      await expect(
        service.updateUser('target-user-id', { role: 'admin' } as never, {
          role: 'admin',
        }),
      ).resolves.toMatchObject({ message: 'User updated successfully' });
    });
  });

  describe('deleteUser', () => {
    it('blocks a non-admin from deleting an admin account', async () => {
      userModel.findById.mockResolvedValue({ _id: 'admin-id', role: 'admin' });

      await expect(
        service.deleteUser('admin-id', { role: 'trainer' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(userModel.deleteOne).not.toHaveBeenCalled();
    });

    it('allows a non-admin to delete a non-admin account', async () => {
      userModel.findById.mockResolvedValue({
        _id: 'trainer-id',
        role: 'trainer',
      });
      userModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await expect(
        service.deleteUser('trainer-id', { role: 'trainer' }),
      ).resolves.toMatchObject({ message: 'User deleted successfully' });

      expect(userModel.deleteOne).toHaveBeenCalled();
    });

    it('allows an admin to delete an admin account', async () => {
      userModel.findById.mockResolvedValue({ _id: 'admin-id', role: 'admin' });
      userModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await expect(
        service.deleteUser('admin-id', { role: 'admin' }),
      ).resolves.toMatchObject({ message: 'User deleted successfully' });
    });
  });
});
