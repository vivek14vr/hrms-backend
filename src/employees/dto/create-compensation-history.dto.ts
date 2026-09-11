import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCompensationHistoryDto {
  @IsDateString() effectiveFrom!: string;
  @IsNumber() @Min(0.01) baseSalary!: number;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
