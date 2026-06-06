export type AuthenticatedSocketUser = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

export type NotificationEnvelope<TPayload = unknown> = {
  id: string;
  channel: string;
  event: string;
  payload: TPayload;
  createdAt: string;
  metadata?: {
    userId?: string | null;
    workspaceId?: string | null;
    source?: string;
    requestId?: string;
    correlationId?: string;
    [key: string]: unknown;
  };
};

export type SubscribeChannelPayload = {
  channel: string;
};

export type UnsubscribeChannelPayload = {
  channel: string;
};

export type ConnectionRecord = {
  connectionId: string;
  userId: string;
  connectedAt: Date;
  channels: Set<string>;
};

export type ChannelSubscriptionRecord = {
  channel: string;
  userConnections: Map<string, Set<string>>;
};
