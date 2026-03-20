import { Request } from 'express';
import { prisma } from '../index';

export type LogAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_LOCKED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_CHANGED'
  | '2FA_ENABLED'
  | '2FA_DISABLED'
  | 'EMAIL_SENT'
  | 'EMAIL_GENERATED'
  | 'EMAIL_SCHEDULED'
  | 'WHATSAPP_SENT'
  | 'LEAD_DELETED'
  | 'LEADS_BULK_DELETED'
  | 'SETTINGS_UPDATED'
  | 'USER_INVITED'
  | 'USER_REMOVED'
  | 'USER_ROLE_CHANGED'
  | 'SESSION_REVOKED'
  | 'ALL_SESSIONS_REVOKED'
  | 'ADMIN_ACCESS_BLOCKED';

interface LogOptions {
  userId?: string;
  userEmail?: string;
  action: LogAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function logActivity(options: LogOptions): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: options.userId || null,
        userEmail: options.userEmail || null,
        action: options.action,
        targetType: options.targetType || null,
        targetId: options.targetId || null,
        metadata: (options.metadata as object) || null,
        ipAddress: options.req ? getIp(options.req) : null,
        userAgent: options.req?.headers['user-agent'] || null,
      },
    });
  } catch {
    // Never let logging failure break the actual operation
  }
}

export function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
