import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
export declare class AttendanceService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(user: RequestUser, query: {
        employeeId?: string;
        department?: string;
        status?: AttendanceStatus;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        limit?: number;
    }): Promise<{
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
            workHours: Prisma.Decimal | null;
            notes: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    summary(user: RequestUser, month?: number, year?: number): Promise<{
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
        workHours: Prisma.Decimal | null;
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
        workHours: Prisma.Decimal | null;
        notes: string | null;
    }>;
    remove(id: string, user: RequestUser): Promise<{
        success: boolean;
    }>;
    csv(user: RequestUser, query: any): Promise<string>;
}
