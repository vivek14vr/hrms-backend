import { EmploymentStatus } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { RequestUser } from '../common/types/request-user';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
export declare class EmployeesController {
    private readonly employees;
    constructor(employees: EmployeesService);
    findAll(search?: string, department?: string, status?: EmploymentStatus, designation?: string, page?: string, limit?: string): Promise<{
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
            baseSalary: import("@prisma/client/runtime/library").Decimal;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    departments(): Promise<string[]>;
    findOne(id: string, user: RequestUser): Promise<{
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
        baseSalary: import("@prisma/client/runtime/library").Decimal;
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
        baseSalary: import("@prisma/client/runtime/library").Decimal;
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
        baseSalary: import("@prisma/client/runtime/library").Decimal;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
