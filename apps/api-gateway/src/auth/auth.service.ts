import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, RefreshToken } from '../database/entities';
import { JwtPayload } from './strategies/jwt.strategy';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly tokenRepo: Repository<RefreshToken>,

    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email, isActive: true },
      relations: ['role'],
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const tokens = await this.generateTokens(user, ipAddress);

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name,
        permissions: user.role.permissions,
      },
    };
  }

  async refresh(rawToken: string, ipAddress?: string) {
    const stored = await this.tokenRepo.findOne({
      where: { token: rawToken, isRevoked: false },
      relations: ['user', 'user.role'],
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token ไม่ถูกต้องหรือหมดอายุ');
    }

    // Rotate: revoke old token, issue new pair
    await this.tokenRepo.update(stored.id, { isRevoked: true });

    return this.generateTokens(stored.user, ipAddress);
  }

  async logout(rawToken: string) {
    await this.tokenRepo.update(
      { token: rawToken, isRevoked: false },
      { isRevoked: true },
    );
  }

  private async generateTokens(user: User, ipAddress?: string) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions,
    };

    const accessToken = this.jwtService.sign(payload);

    // Refresh token — longer-lived, stored in DB
    const refreshExpiresIn = this.config.get<string>('REFRESH_EXPIRES', '7d');
    const expiresAt = this.parseExpiry(refreshExpiresIn);

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { secret: this.config.getOrThrow('JWT_SECRET'), expiresIn: refreshExpiresIn },
    );

    await this.tokenRepo.save(
      this.tokenRepo.create({
        user,
        token: refreshToken,
        expiresAt,
        ipAddress: ipAddress ?? null,
      }),
    );

    return { accessToken, refreshToken };
  }

  private parseExpiry(expiry: string): Date {
    const now = Date.now();
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) throw new BadRequestException('Invalid REFRESH_EXPIRES format');
    const value = parseInt(match[1]);
    const unit = match[2];
    const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
    return new Date(now + value * ms);
  }
}
