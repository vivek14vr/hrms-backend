"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAttendanceDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_attendance_dto_1 = require("./create-attendance.dto");
class UpdateAttendanceDto extends (0, swagger_1.PartialType)(create_attendance_dto_1.CreateAttendanceDto) {
}
exports.UpdateAttendanceDto = UpdateAttendanceDto;
//# sourceMappingURL=update-attendance.dto.js.map