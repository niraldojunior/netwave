import { AppError } from '../errors/app-error.js';
import type { MigrationStatus } from './types.js';

export const ALLOWED_TRANSITIONS: Record<MigrationStatus, readonly MigrationStatus[]> = {
  IMPORTED: ['PREPARING'],
  PREPARING: ['ADDRESS_EXCEPTION', 'NOT_VIABLE', 'READY'],
  ADDRESS_EXCEPTION: ['PREPARING'],
  NOT_VIABLE: ['PREPARING'],
  READY: ['AUTHORIZED'],
  AUTHORIZED: ['OS_CREATING'],
  OS_CREATING: ['OS_CREATED', 'READY'],
  OS_CREATED: ['SCHEDULED'],
  SCHEDULED: ['SCHEDULED', 'IN_FIELD'],
  IN_FIELD: ['SERIAL_EXCEPTION', 'ACTIVATING'],
  SERIAL_EXCEPTION: ['IN_FIELD'],
  ACTIVATING: ['MIGRATED', 'MIGRATION_FAILED'],
  MIGRATION_FAILED: ['ACTIVATING', 'ROLLBACK_REQUESTED'],
  ROLLBACK_REQUESTED: ['ROLLBACK_IN_PROGRESS'],
  ROLLBACK_IN_PROGRESS: ['ROLLED_BACK'],
  ROLLED_BACK: [],
  MIGRATED: [],
};

export class MigrationStateMachine {
  public static canTransition(current: MigrationStatus, target: MigrationStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[current];
    return allowed ? allowed.includes(target) : false;
  }

  public static assertTransition(current: MigrationStatus, target: MigrationStatus, itemId?: string): void {
    if (!this.canTransition(current, target)) {
      throw new AppError(
        `Transição de estado inválida para o item ${itemId ?? ''}: de '${current}' para '${target}'.`,
        400,
        'INVALID_STATE_TRANSITION',
        { current, target, allowed: ALLOWED_TRANSITIONS[current] }
      );
    }
  }
}
