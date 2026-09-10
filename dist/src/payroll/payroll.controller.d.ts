import { PaymentStatus } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { RequestUser } from '../common/types/request-user';
import { CreateSalarySlipDto } from './dto/create-salary-slip.dto';
import { UpdateSalarySlipDto } from './dto/update-salary-slip.dto';
export declare class PayrollController {
    private readonly payroll;
    constructor(payroll: PayrollService);
    findAll(user: RequestUser, employeeId?: string, department?: string, month?: string, year?: string, paymentStatus?: PaymentStatus, page?: string, limit?: string): Promise<{
        items: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findOne(id: string, user: RequestUser): Promise<any>;
    forEmployee(employeeId: string, user: RequestUser, month?: string, year?: string): Promise<any[]>;
    create(employeeId: string, dto: CreateSalarySlipDto): Promise<any>;
    update(id: string, dto: UpdateSalarySlipDto): Promise<any>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
