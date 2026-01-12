import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
    @Get()
    health() {
        return { ok: true, message: "NRWashingPlus API is running" };
    }
}
