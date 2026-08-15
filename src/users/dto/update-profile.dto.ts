import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
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
}