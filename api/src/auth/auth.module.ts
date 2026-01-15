import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
    imports: [
        PassportModule,
        JwtModule.register({
            secret: 'SECRET_KEY_123',
            signOptions: { expiresIn: '7d' }, //1m Day Login Session
        }),
    ],
    providers: [AuthService, PrismaService, JwtStrategy],
    controllers: [AuthController],
})
export class AuthModule { }