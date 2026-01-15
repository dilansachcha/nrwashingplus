import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
    constructor(private reports: ReportsService) { }

    @Get('dashboard')
    getStats(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('branch') branch?: string, // ✅ Added Branch Parameter
    ) {
        const today = new Date().toISOString().split('T')[0];
        return this.reports.getDashboardStats(startDate || today, endDate || today, branch);
    }
}