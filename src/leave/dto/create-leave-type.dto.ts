import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString() @MinLength(2) code!: string;
  @IsString() @MinLength(2) name!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(366) annualAllowance!: number;
  @IsOptional() @IsBoolean() paid?: boolean;
}
