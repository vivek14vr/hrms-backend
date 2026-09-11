import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(100) timezone?: string;
  @IsOptional() @Matches(/^[A-Za-z]{3}$/) currency?: string;
  @IsOptional() @IsIn(['Monday – Friday', 'Sunday – Thursday', 'Monday – Saturday']) workWeek?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) shiftStart?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) shiftEnd?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(240) graceMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440) overtimeAfterMinutes?: number;
}
