import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService, private jwt: JwtService) { }

    async login(username: string, pass: string) {
        // 1. Find user by username
        const user = await this.prisma.user.findUnique({ where: { email: username } });

        // Debugging: Print what we found (Check your terminal console)
        console.log(`Login attempt for: ${username}`);

        if (!user) {
            console.log('User not found');
            throw new UnauthorizedException('Invalid credentials');
        }

        // 2. PLAIN TEXT CHECK (Matches your current DB)
        // We compare the input 'pass' directly with the DB 'passwordHash'
        if (user.passwordHash !== pass) {
            console.log(`Password mismatch. Input: ${pass}, DB: ${user.passwordHash}`);
            throw new UnauthorizedException('Invalid credentials');
        }

        // 3. Generate Token
        const payload = { sub: user.id, username: user.email, role: user.role };

        let branch = null;
        if (user.email === 'staffA') branch = 'A';
        if (user.email === 'staffB') branch = 'B';

        return {
            access_token: this.jwt.sign({ ...payload, branch }),
            user: { name: user.fullName, role: user.role, branch }
        };
    }
}