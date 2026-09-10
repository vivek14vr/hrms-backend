import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsIn(['admin', 'employee']) portal?: 'admin' | 'employee';
}
