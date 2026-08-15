import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message:
      'Phone number must contain 10 digits and start with 6, 7, 8 or 9',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  profileImage?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(['admin', 'trainer'])
  role?: 'admin' | 'trainer';
}