import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { PagePermissionsDto } from './page-permissions.dto';
import { GranularPermissionsDto } from './student-permissions.dto';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone number must contain 10 digits and start with 6, 7, 8 or 9',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  profileImage?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(['admin', 'trainer'])
  role!: 'admin' | 'trainer';

  @IsOptional()
  @ValidateNested()
  @Type(() => PagePermissionsDto)
  pagePermissions?: PagePermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GranularPermissionsDto)
  granularPermissions?: GranularPermissionsDto;
}
