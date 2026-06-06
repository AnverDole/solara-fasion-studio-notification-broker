import { Injectable, Logger } from '@nestjs/common';

import {
  AuthenticatedSocketUser,
  ConnectionRecord,
  NotificationEnvelope,
} from './notification-instance.types';

@Injectable()
export class NotificationConnectionRegistryService {
  private readonly logger = new Logger(
    NotificationConnectionRegistryService.name,
  );

  /**
   * connectionId -> connection record
   */
  private readonly connections = new Map<string, ConnectionRecord>();

  /**
   * userId -> connectionIds
   */
  private readonly userConnections = new Map<string, Set<string>>();

  /**
   * channel -> userId -> connectionIds
   */
  private readonly channelSubscriptions = new Map<
    string,
    Map<string, Set<string>>
  >();

  addConnection(input: {
    connectionId: string;
    user: AuthenticatedSocketUser;
  }): void {
    this.connections.set(input.connectionId, {
      connectionId: input.connectionId,
      userId: input.user.id,
      connectedAt: new Date(),
      channels: new Set<string>(),
    });

    this.getOrCreateSet(this.userConnections, input.user.id).add(
      input.connectionId,
    );

    this.logger.log(
      `Socket connected. userId=${input.user.id}, connectionId=${input.connectionId}`,
    );
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      return;
    }

    for (const channel of connection.channels) {
      this.unsubscribe({
        connectionId,
        userId: connection.userId,
        channel,
      });
    }

    const userConnectionSet = this.userConnections.get(connection.userId);
    userConnectionSet?.delete(connectionId);

    if (userConnectionSet?.size === 0) {
      this.userConnections.delete(connection.userId);
    }

    this.connections.delete(connectionId);

    this.logger.log(
      `Socket disconnected. userId=${connection.userId}, connectionId=${connectionId}`,
    );
  }

  subscribe(input: {
    connectionId: string;
    userId: string;
    channel: string;
  }): void {
    const connection = this.connections.get(input.connectionId);

    if (!connection) {
      return;
    }

    connection.channels.add(input.channel);

    const channelUsers = this.getOrCreateMap(
      this.channelSubscriptions,
      input.channel,
    );

    this.getOrCreateSet(channelUsers, input.userId).add(input.connectionId);

    this.logger.debug(
      `Socket subscribed. userId=${input.userId}, connectionId=${input.connectionId}, channel=${input.channel}`,
    );
  }

  unsubscribe(input: {
    connectionId: string;
    userId: string;
    channel: string;
  }): void {
    const connection = this.connections.get(input.connectionId);
    connection?.channels.delete(input.channel);

    const channelUsers = this.channelSubscriptions.get(input.channel);

    if (!channelUsers) {
      return;
    }

    const connectionSet = channelUsers.get(input.userId);
    connectionSet?.delete(input.connectionId);

    if (connectionSet?.size === 0) {
      channelUsers.delete(input.userId);
    }

    if (channelUsers.size === 0) {
      this.channelSubscriptions.delete(input.channel);
    }

    this.logger.debug(
      `Socket unsubscribed. userId=${input.userId}, connectionId=${input.connectionId}, channel=${input.channel}`,
    );
  }

  getUserIdForConnection(connectionId: string): string | null {
    return this.connections.get(connectionId)?.userId ?? null;
  }

  getConnectionIdsForEnvelope(envelope: NotificationEnvelope): string[] {
    const channelUsers = this.channelSubscriptions.get(envelope.channel);

    if (!channelUsers) {
      return [];
    }

    const targetUserId = envelope.metadata?.userId;

    if (targetUserId) {
      return Array.from(channelUsers.get(targetUserId) ?? []);
    }

    const allConnectionIds = new Set<string>();

    for (const connectionSet of channelUsers.values()) {
      for (const connectionId of connectionSet) {
        allConnectionIds.add(connectionId);
      }
    }

    return Array.from(allConnectionIds);
  }

  getStats() {
    return {
      connectionCount: this.connections.size,
      userCount: this.userConnections.size,
      channelCount: this.channelSubscriptions.size,
    };
  }

  private getOrCreateSet<K>(map: Map<K, Set<string>>, key: K): Set<string> {
    let value = map.get(key);

    if (!value) {
      value = new Set<string>();
      map.set(key, value);
    }

    return value;
  }

  private getOrCreateMap<K, K2, V2>(
    map: Map<K, Map<K2, V2>>,
    key: K,
  ): Map<K2, V2> {
    let value = map.get(key);

    if (!value) {
      value = new Map<K2, V2>();
      map.set(key, value);
    }

    return value;
  }
}
