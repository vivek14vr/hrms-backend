"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("../src/common/guards/roles.guard");
const employees_service_1 = require("../src/employees/employees.service");
describe('PeopleOS authorization boundaries', () => {
    it('rejects an employee when an admin-only role is required', () => {
        const reflector = { getAllAndOverride: jest.fn().mockReturnValue([client_1.UserRole.ADMIN]) };
        const guard = new roles_guard_1.RolesGuard(reflector);
        const context = { getHandler: jest.fn(), getClass: jest.fn(), switchToHttp: () => ({ getRequest: () => ({ user: { role: client_1.UserRole.EMPLOYEE } }) }) };
        expect(() => guard.canActivate(context)).toThrow(common_1.ForbiddenException);
    });
    it('blocks an employee from reading another employee profile', async () => {
        const prisma = { employee: { findUnique: jest.fn() } };
        const employees = new employees_service_1.EmployeesService(prisma);
        await expect(employees.findOne('employee-two', { id: 'u1', name: 'Ava', email: 'employee@peopleos.demo', role: client_1.UserRole.EMPLOYEE, employeeId: 'employee-one' })).rejects.toThrow(common_1.ForbiddenException);
        expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=authorization.spec.js.map