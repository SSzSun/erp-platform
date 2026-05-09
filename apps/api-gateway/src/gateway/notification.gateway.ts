import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private subscriber: ReturnType<typeof createClient>;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    // Subscribe to Redis channel published by Go attendance service
    const redisUrl = this.config.getOrThrow<string>('REDIS_URL');
    this.subscriber = createClient({ url: redisUrl });
    await this.subscriber.connect();

    await this.subscriber.subscribe('erp:attendance:events', (message) => {
      try {
        const event = JSON.parse(message) as {
          employeeId: string;
          scanType: string;
          timestamp: number;
          location: string;
        };
        // Broadcast to all connected dashboard clients
        this.server.emit('attendance:event', event);
      } catch {
        // malformed message — ignore
      }
    });

    this.logger.log('Subscribed to Redis attendance events');
  }

  async onModuleDestroy() {
    await this.subscriber?.quit();
  }

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.getOrThrow('JWT_SECRET'),
      });
      // Attach user info to socket for room-based targeting later
      client.data.userId = payload.sub as string;
      client.data.role = payload.role as string;
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Client subscribes to their own payroll notifications
  @SubscribeMessage('subscribe:payroll')
  handlePayrollSubscribe(@ConnectedSocket() client: Socket, @MessageBody() _: unknown) {
    client.join(`payroll:${client.data.userId}`);
  }

  // Emit payroll-ready notification to a specific user (called from PayrollService)
  notifyPayrollReady(userId: string, payload: { year: number; month: number; netPay: number }) {
    this.server.to(`payroll:${userId}`).emit('payroll:ready', payload);
  }
}
