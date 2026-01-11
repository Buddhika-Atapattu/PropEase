// ============================================================================
// Transport-neutral realtime envelope (matches backend realtime contracts style)
// ============================================================================

export type RealtimeAudienceKind = 'org' | 'branch' | 'property' | 'team' | 'member';

export interface RealtimeAudience {
  kind: RealtimeAudienceKind;
  id: string;
}

export interface RealtimeDeliveryHints {
  allowCoalesce?: boolean;
  dedupeKey?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface RealtimeProducer {
  kind: 'system' | 'user';
  principalId: string;
}

export interface RealtimeEventEnvelope<TPayload> {
  eventId: string;
  topic: string;
  producer: RealtimeProducer;
  audiences: ReadonlyArray<RealtimeAudience>;
  eventType: string;
  occurredAt: string;
  hints?: RealtimeDeliveryHints;
  payload: TPayload;
}
