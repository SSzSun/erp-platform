import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

export const PAYROLL_GRPC = 'PAYROLL_GRPC';
export const ATTENDANCE_GRPC = 'ATTENDANCE_GRPC';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: PAYROLL_GRPC,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            url: config.get<string>('GO_SERVICE_URL', 'localhost:50051'),
            package: 'payroll',
            protoPath: join(process.cwd(), '../../proto/payroll.proto'),
          },
        }),
      },
      {
        name: ATTENDANCE_GRPC,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            url: config.get<string>('GO_SERVICE_URL', 'localhost:50051'),
            package: 'attendance',
            protoPath: join(process.cwd(), '../../proto/attendance.proto'),
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientModule {}
