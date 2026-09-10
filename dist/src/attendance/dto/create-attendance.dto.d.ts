import { AttendanceStatus } from '@prisma/client';
export declare class CreateAttendanceDto {
    employeeId?: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    workHours?: number;
    status: AttendanceStatus;
    notes?: string;
}
