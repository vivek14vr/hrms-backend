import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @IsOptional() @IsDateString() compensationEffectiveFrom?: string;
  @IsOptional() @IsString() @MinLength(3) compensationReason?: string;
}
