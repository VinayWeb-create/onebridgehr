/**
 * Channel abstraction for the reminder engine. New delivery mechanisms
 * (email, WhatsApp, SMS, Microsoft Teams...) plug in by implementing
 * `NotificationChannel` and registering in `channels/index.ts` — the
 * scheduler, retry and dedupe logic stay unchanged.
 */

export type ChannelName = 'IN_APP' | 'PUSH' | 'EMAIL' | 'WHATSAPP' | 'SMS' | 'TEAMS';

export interface ReminderMessage {
  reminderId: string;
  employeeId: string;
  taskId: string | null;
  title: string;
  body: string;
  priority: string;
  dueAt: Date | null;
  kind: string;
  url: string;
  silent: boolean;
  /** Short-lived signed token that lets the service worker act on the reminder. */
  actionToken?: string;
  badgeCount?: number;
  meta?: Record<string, unknown>;
}

export interface ChannelResult {
  ok: boolean;
  /** True when the failure is permanent and retrying won't help. */
  permanent?: boolean;
  error?: string;
}

export interface NotificationChannel {
  readonly name: ChannelName;
  /** Whether this channel is wired up on this server (credentials, provider...). */
  isConfigured(): boolean;
  send(message: ReminderMessage): Promise<ChannelResult>;
}

export interface ChannelPreferences {
  channelInApp: boolean;
  channelPush: boolean;
  channelEmail: boolean;
  channelWhatsapp: boolean;
  channelSms: boolean;
}

export function enabledChannelNames(prefs: ChannelPreferences, mandatory: boolean): ChannelName[] {
  const names: ChannelName[] = [];
  // In-app is always recorded for mandatory reminders so there is an audit trail.
  if (prefs.channelInApp || mandatory) names.push('IN_APP');
  if (prefs.channelPush || mandatory) names.push('PUSH');
  if (prefs.channelEmail) names.push('EMAIL');
  if (prefs.channelWhatsapp) names.push('WHATSAPP');
  if (prefs.channelSms) names.push('SMS');
  return names;
}
