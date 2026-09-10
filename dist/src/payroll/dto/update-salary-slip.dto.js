"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSalarySlipDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_salary_slip_dto_1 = require("./create-salary-slip.dto");
class UpdateSalarySlipDto extends (0, swagger_1.PartialType)(create_salary_slip_dto_1.CreateSalarySlipDto) {
}
exports.UpdateSalarySlipDto = UpdateSalarySlipDto;
//# sourceMappingURL=update-salary-slip.dto.js.map