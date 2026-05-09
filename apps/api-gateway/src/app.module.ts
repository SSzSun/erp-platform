import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department, Employee, RefreshToken, Role, User } from './database/entities';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Department, Role, User, Employee, RefreshToken],
        synchronize: config.get('NODE_ENV') !== 'production',
        ssl: config.get('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        extra: { max: config.get<number>('DB_POOL_MAX') ?? 20 },
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
