import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { NotificationAuthService } from './notification-auth.service';
import { NotificationConnectionRegistryService } from './notification-connection-registry.service';
import type {
  AuthenticatedSocketUser,
  NotificationEnvelope,
  SubscribeChannelPayload,
  UnsubscribeChannelPayload,
} from './notification-instance.types';

type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthenticatedSocketUser;
  };
};

@WebSocketGateway({
  cors: {
    origin: process.env.NOTIFICATION_INSTANCE_CORS_ORIGIN ?? true,
    credentials: true,
  },
  transports: ['websocket'],
  pingInterval: 25000,
  pingTimeout: 30000,
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly authService: NotificationAuthService,
    private readonly registry: NotificationConnectionRegistryService,
  ) {}

  handleConnection(socket: AuthenticatedSocket): void {
    console.log('sdsd');

    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

      const user = this.authService.verifyHandshakeToken(token);

      socket.data.user = user;

      this.registry.addConnection({
        connectionId: socket.id,
        user,
      });

      socket.emit('connected', {
        connectionId: socket.id,
        userId: user.id,
        connectedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message =
        error instanceof UnauthorizedException
          ? error.message
          : 'Unauthorized WebSocket connection';

      socket.emit('error', {
        code: 'unauthorized',
        message,
      });

      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthenticatedSocket): void {
    this.registry.removeConnection(socket.id);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: SubscribeChannelPayload,
  ) {
    const user = this.getSocketUser(socket);
    const channel = this.normalizeChannel(payload?.channel);

    this.assertCanSubscribe(user.id, channel);

    this.registry.subscribe({
      connectionId: socket.id,
      userId: user.id,
      channel,
    });

    socket.emit('subscribed', {
      channel,
      connectionId: socket.id,
      subscribedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      channel,
    };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: UnsubscribeChannelPayload,
  ) {
    const user = this.getSocketUser(socket);
    const channel = this.normalizeChannel(payload?.channel);

    this.registry.unsubscribe({
      connectionId: socket.id,
      userId: user.id,
      channel,
    });

    socket.emit('unsubscribed', {
      channel,
      connectionId: socket.id,
      unsubscribedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      channel,
    };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: AuthenticatedSocket) {
    const user = this.getSocketUser(socket);

    return {
      ok: true,
      userId: user.id,
      connectionId: socket.id,
      time: new Date().toISOString(),
    };
  }

  emitEnvelope(envelope: NotificationEnvelope): void {
    const connectionIds = this.registry.getConnectionIdsForEnvelope(envelope);

    if (connectionIds.length === 0) {
      this.logger.debug(
        `No active subscribers. channel=${envelope.channel}, event=${envelope.event}`,
      );
      return;
    }

    for (const connectionId of connectionIds) {
      this.server.to(connectionId).emit('message', envelope);
    }

    this.logger.debug(
      `Envelope delivered. channel=${envelope.channel}, event=${envelope.event}, connections=${connectionIds.length}`,
    );
  }

  private getSocketUser(socket: AuthenticatedSocket): AuthenticatedSocketUser {
    if (!socket.data.user) {
      throw new WsException('Unauthenticated socket');
    }

    return socket.data.user;
  }

  private normalizeChannel(channel: unknown): string {
    if (typeof channel !== 'string' || !channel.trim()) {
      throw new WsException('Channel is required');
    }

    return channel.trim();
  }

  /**
   * This is intentionally lightweight.
   * Real strict permission can be added later using signed channel tokens.
   */
  private assertCanSubscribe(userId: string, channel: string): void {
    if (channel === `user:${userId}`) {
      return;
    }

    if (/^accessory-transforms:[a-zA-Z0-9-_]+$/.test(channel)) {
      return;
    }
    if (/^accessory-transforms:[a-zA-Z0-9-_]+:heartbeat$/.test(channel)) {
      return;
    }

    if (/^clothing-transforms:[a-zA-Z0-9-_]+$/.test(channel)) {
      return;
    }

    if (/^clothing-transforms:[a-zA-Z0-9-_]+:heartbeat$/.test(channel)) {
      return;
    }
    if (/^character:[a-zA-Z0-9-_]+:training$/.test(channel)) {
      return;
    }

    if (/^studio-take:[a-zA-Z0-9-_]+$/.test(channel)) {
      return;
    }

    throw new WsException('Forbidden channel');
  }
}
