import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
export declare class EmployeesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(query: {
        search?: string;
        department?: string;
        status?: EmploymentStatus;
        designation?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: ({
            user: {
                email: string;
                id: string;
                name: string;
                role: import("@prisma/client").$Enums.UserRole;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
            } | null;
        } & {
            email: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            employeeCode: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            avatarUrl: string | null;
            department: string;
            designation: string;
            employmentType: import("@prisma/client").$Enums.EmploymentType;
            employmentStatus: import("@prisma/client").$Enums.EmploymentStatus;
            joiningDate: Date;
            managerName: string | null;
            location: string | null;
            dateOfBirth: Date | null;
            address: string | null;
            emergencyContactName: string | null;
            emergencyContactPhone: string | null;
            baseSalary: Prisma.Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findOne(id: string, user?: RequestUser): Promise<{
        user: {
            email: string;
            id: string;
            name: string;
            role: import("@prisma/client").$Enums.UserRole;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        email: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        employeeCode: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        department: string;
        designation: string;
        employmentType: import("@prisma/client").$Enums.EmploymentType;
        employmentStatus: import("@prisma/client").$Enums.EmploymentStatus;
        joiningDate: Date;
        managerName: string | null;
        location: string | null;
        dateOfBirth: Date | null;
        address: string | null;
        emergencyContactName: string | null;
        emergencyContactPhone: string | null;
        baseSalary: Prisma.Decimal;
    }>;
    create(dto: CreateEmployeeDto): Promise<{
        user: {
            email: string;
            id: string;
            name: string;
            role: import("@prisma/client").$Enums.UserRole;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        email: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        employeeCode: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        department: string;
        designation: string;
        employmentType: import("@prisma/client").$Enums.EmploymentType;
        employmentStatus: import("@prisma/client").$Enums.EmploymentStatus;
        joiningDate: Date;
        managerName: string | null;
        location: string | null;
        dateOfBirth: Date | null;
        address: string | null;
        emergencyContactName: string | null;
        emergencyContactPhone: string | null;
        baseSalary: Prisma.Decimal;
    }>;
    update(id: string, dto: UpdateEmployeeDto): Promise<{
        user: {
            email: string;
            id: string;
            name: string;
            role: import("@prisma/client").$Enums.UserRole;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        email: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        employeeCode: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        department: string;
        designation: string;
        employmentType: import("@prisma/client").$Enums.EmploymentType;
        employmentStatus: import("@prisma/client").$Enums.EmploymentStatus;
        joiningDate: Date;
        managerName: string | null;
        location: string | null;
        dateOfBirth: Date | null;
        address: string | null;
        emergencyContactName: string | null;
        emergencyContactPhone: string | null;
        baseSalary: Prisma.Decimal;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
    departments(): Promise<string[]>;
}
