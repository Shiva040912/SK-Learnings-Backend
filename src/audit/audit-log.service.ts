import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuditLog, AuditLogDocument } from './audit-log.schema';

export interface AuditActor {
  userId: string;
  role: string;
}

export interface RecordAuditEntryInput {
  action: string;
  targetId: string;
  targetType?: string;
  performedBy: AuditActor;
  amount?: number | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  // Callers must only invoke this AFTER the underlying financial write has
  // already committed — never before, and never to represent a failed
  // operation as having happened. A failure here is swallowed (logged,
  // not thrown): the money-affecting operation already succeeded by this
  // point, so an audit-write hiccup must not turn that into a user-facing
  // error, and it must never roll back or retroactively "undo" the
  // already-committed financial change either.
  async record(entry: RecordAuditEntryInput): Promise<void> {
    try {
      await this.auditLogModel.create({
        action: entry.action,
        targetType: entry.targetType || 'Student',
        targetId: entry.targetId,
        performedBy: entry.performedBy.userId,
        performedByRole: entry.performedBy.role,
        amount: entry.amount ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
      });
    } catch (error) {
      console.error('Audit log write failed:', error);
    }
  }
}
