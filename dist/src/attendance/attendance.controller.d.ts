import { AttendanceStatus } from '@prisma/client';
import { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { RequestUser } from '../common/types/request-user';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
export declare class AttendanceController {
    private readonly attendance;
    constructor(attendance: AttendanceService);
    findAll(user: RequestUser, employeeId?: string, department?: string, status?: AttendanceStatus, dateFrom?: string, dateTo?: string, page?: string, limit?: string): Promise<{
        items: ({
            employee: {
                id: string;
                employeeCode: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
                department: string;
                designation: string;
            };
        } & {
            id: string;
            employeeId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.AttendanceStatus;
            date: Date;
            checkIn: Date | null;
            checkOut: Date | null;
            workHours: import("@prisma/client/runtime/library").Decimal | null;
            notes: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    summary(user: RequestUser, month?: string, year?: string): Promise<{
        month: number;
        year: number;
        total: number;
        present: number;
        absent: number;
        late: number;
        leave: number;
        workFromHome: number;
        attendancePercentage: number;
    }>;
    exportCsv(user: RequestUser, response: Response, query: any): Promise<void>;
    create(dto: CreateAttendanceDto, user: RequestUser): Promise<{
        employee: {
            id: string;
            employeeCode: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
            department: string;
            designation: string;
        };
    } & {
        id: string;
        employeeId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.AttendanceStatus;
        date: Date;
        checkIn: Date | null;
        checkOut: Date | null;
        workHours: import("@prisma/client/runtime/library").Decimal | null;
        notes: string | null;
    }>;
    update(id: string, dto: UpdateAttendanceDto, user: RequestUser): Promise<{
        employee: {
            id: string;
            employeeCode: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
            department: string;
            designation: string;
        };
    } & {
        id: string;
        employeeId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.AttendanceStatus;
        date: Date;
        checkIn: Date | null;
        checkOut: Date | null;
        workHours: import("@prisma/client/runtime/library").Decimal | null;
        notes: string | null;
    }>;
    remove(id: string, user: RequestUser): Promise<{
        success: boolean;
    }>;
}
