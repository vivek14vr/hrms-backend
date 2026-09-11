import { IsString, Matches, MinLength } from 'class-validator';

export class CompletePasswordResetDto {
  @IsString() @MinLength(32) token!: string;
  @IsString() @MinLength(12) @Matches(/[a-z]/, { message: 'Password must include a lowercase letter' }) @Matches(/[A-Z]/, { message: 'Password must include an uppercase letter' }) @Matches(/[0-9]/, { message: 'Password must include a number' }) @Matches(/[^A-Za-z0-9]/, { message: 'Password must include a special character' }) password!: string;
}
