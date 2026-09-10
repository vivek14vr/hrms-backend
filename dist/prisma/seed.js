"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Finance', 'Human Resources'];
const employees = [
    ['Ava', 'Sharma', 'Engineering', 'Senior Software Engineer', 'Bengaluru', 98000],
    ['Liam', 'Chen', 'Product', 'Product Manager', 'Singapore', 112000],
    ['Maya', 'Patel', 'Design', 'Product Designer', 'Mumbai', 84000],
    ['Noah', 'Williams', 'Engineering', 'Staff Engineer', 'New York', 128000],
    ['Sofia', 'Garcia', 'Marketing', 'Growth Lead', 'London', 93000],
    ['Ethan', 'Brown', 'Finance', 'Financial Analyst', 'Dublin', 76000],
    ['Isha', 'Nair', 'Human Resources', 'People Partner', 'Bengaluru', 82000],
    ['Oliver', 'Martin', 'Engineering', 'Frontend Engineer', 'Berlin', 89000],
    ['Zoe', 'Anderson', 'Product', 'Product Analyst', 'Toronto', 72000],
    ['Arjun', 'Mehta', 'Design', 'UX Researcher', 'Pune', 78000],
    ['Emma', 'Wilson', 'Marketing', 'Content Strategist', 'Sydney', 69000],
    ['Lucas', 'Silva', 'Finance', 'Controller', 'Lisbon', 101000],
];
const dateAt = (date, hour, minute = 0) => {
    const copy = new Date(date);
    copy.setHours(hour, minute, 0, 0);
    return copy;
};
async function main() {
    await prisma.salarySlip.deleteMany();
    await prisma.attendanceRecord.deleteMany();
    await prisma.user.deleteMany();
    await prisma.employee.deleteMany();
    const passwordHash = await bcryptjs_1.default.hash('Employee@123', 12);
    const employeeRows = [];
    for (let index = 0; index < employees.length; index += 1) {
        const [firstName, lastName, department, designation, location, baseSalary] = employees[index];
        const joiningDate = new Date(2022 + (index % 3), index % 12, 4 + index);
        const row = await prisma.employee.create({
            data: {
                employeeCode: `PO-${String(index + 1).padStart(4, '0')}`,
                firstName, lastName, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@peopleos.demo`,
                phone: `+1 555 01${String(index).padStart(2, '2')}`, department, designation,
                employmentType: index === 5 ? client_1.EmploymentType.CONTRACT : client_1.EmploymentType.FULL_TIME,
                employmentStatus: index === 8 ? client_1.EmploymentStatus.ON_LEAVE : client_1.EmploymentStatus.ACTIVE,
                joiningDate, managerName: index === 0 ? 'Noah Williams' : 'Isha Nair', location,
                dateOfBirth: new Date(1990 - (index % 7), (index + 2) % 12, 10 + (index % 15)),
                address: `${100 + index} People Street, ${location}`,
                emergencyContactName: `Contact for ${firstName}`, emergencyContactPhone: `+1 555 99${String(index).padStart(2, '2')}`,
                baseSalary,
            },
        });
        employeeRows.push(row);
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let employeeIndex = 0; employeeIndex < employeeRows.length; employeeIndex += 1) {
        for (let day = 1; day <= Math.min(now.getDate(), 28); day += 1) {
            const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
            if (date.getDay() === 0 || date.getDay() === 6)
                continue;
            const pattern = (employeeIndex + day) % 13;
            const status = pattern === 0 ? client_1.AttendanceStatus.LEAVE : pattern === 1 ? client_1.AttendanceStatus.WORK_FROM_HOME : pattern === 2 ? client_1.AttendanceStatus.LATE : pattern === 3 ? client_1.AttendanceStatus.ABSENT : client_1.AttendanceStatus.PRESENT;
            await prisma.attendanceRecord.create({
                data: {
                    employeeId: employeeRows[employeeIndex].id, date,
                    checkIn: new Set([client_1.AttendanceStatus.PRESENT, client_1.AttendanceStatus.LATE, client_1.AttendanceStatus.WORK_FROM_HOME]).has(status) ? dateAt(date, status === client_1.AttendanceStatus.LATE ? 10 : 9, status === client_1.AttendanceStatus.LATE ? 18 : 4) : null,
                    checkOut: new Set([client_1.AttendanceStatus.PRESENT, client_1.AttendanceStatus.LATE, client_1.AttendanceStatus.WORK_FROM_HOME]).has(status) ? dateAt(date, 18, 12) : null,
                    workHours: status === client_1.AttendanceStatus.PRESENT ? 8.13 : status === client_1.AttendanceStatus.LATE ? 7.9 : status === client_1.AttendanceStatus.WORK_FROM_HOME ? 8.0 : null,
                    status,
                    notes: status === client_1.AttendanceStatus.WORK_FROM_HOME ? 'Approved remote day' : undefined,
                },
            });
        }
    }
    for (const employee of employeeRows) {
        for (const offset of [0, 1]) {
            const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            const basic = Number(employee.baseSalary);
            const hra = Math.round(basic * 0.2);
            const transport = 2400;
            const bonus = offset === 1 ? 7500 : 5000;
            const pf = Math.round(basic * 0.12);
            const tax = Math.round(basic * 0.08);
            const professionalTax = 200;
            const gross = basic + hra + transport + bonus;
            const total = pf + tax + professionalTax;
            await prisma.salarySlip.create({
                data: { employeeId: employee.id, month: date.getMonth() + 1, year: date.getFullYear(), basicSalary: basic, houseRentAllowance: hra, transportAllowance: transport, performanceBonus: bonus, providentFund: pf, professionalTax, incomeTax: tax, otherDeductions: 0, grossSalary: gross, totalDeductions: total, netSalary: gross - total, paymentStatus: offset === 1 ? client_1.PaymentStatus.PAID : client_1.PaymentStatus.PROCESSING, paymentDate: offset === 1 ? new Date(date.getFullYear(), date.getMonth(), 28) : null },
            });
        }
    }
    await prisma.user.create({ data: { name: 'Mira Kapoor', email: 'admin@peopleos.demo', passwordHash: await bcryptjs_1.default.hash('Admin@123', 12), role: client_1.UserRole.ADMIN } });
    await prisma.user.create({ data: { name: 'Isha Nair', email: 'hr@peopleos.demo', passwordHash: await bcryptjs_1.default.hash('Hr@123456', 12), role: client_1.UserRole.HR_MANAGER } });
    await prisma.user.create({ data: { name: 'Ava Sharma', email: 'employee@peopleos.demo', passwordHash, role: client_1.UserRole.EMPLOYEE, employeeId: employeeRows[0].id } });
    console.log(`Seeded ${employeeRows.length} employees across ${departments.length} departments.`);
}
main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map