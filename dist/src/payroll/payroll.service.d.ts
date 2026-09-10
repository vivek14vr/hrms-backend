import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { CreateSalarySlipDto } from './dto/create-salary-slip.dto';
import { UpdateSalarySlipDto } from './dto/update-salary-slip.dto';
export declare class PayrollService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(user: RequestUser, query: {
        employeeId?: string;
        department?: string;
        month?: number;
        year?: number;
        paymentStatus?: PaymentStatus;
        page?: number;
        limit?: number;
    }): Promise<{
        items: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findOne(id: string, user: RequestUser): Promise<any>;
    forEmployee(employeeId: string, user: RequestUser, query: {
        month?: number;
        year?: number;
    }): Promise<any[]>;
    create(employeeId: string, dto: CreateSalarySlipDto): Promise<any>;
    update(id: string, dto: UpdateSalarySlipDto): Promise<any>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
