import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
    constructor(private customers: CustomersService) { }

    @Get()
    findAll() {
        return this.customers.findAll();
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() body: { name?: string; phone?: string; address?: string; notes?: string }
    ) {
        return this.customers.update(Number(id), body);
    }

    @Patch(':id/archive')
    toggleArchive(@Param('id') id: string, @Body() body: { isArchived: boolean }) {
        return this.customers.toggleArchive(Number(id), body.isArchived);
    }
}