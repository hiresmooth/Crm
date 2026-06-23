import type { UserRole } from '@prisma/client';
import type { SessionUser } from './auth';

const ROLE_RANK: Record<UserRole, number> = {
  office: 1,
  sales: 2,
  estimator: 3,
  manager: 4,
  admin: 5,
};

export function hasMinRole(user: SessionUser | null, min: UserRole): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[min];
}

export function canViewCosts(user: SessionUser | null): boolean {
  return hasMinRole(user, 'estimator');
}

export function canApproveEstimates(user: SessionUser | null): boolean {
  return hasMinRole(user, 'manager');
}

export function canSendProposals(user: SessionUser | null): boolean {
  if (!user) return false;
  return ['sales', 'manager', 'admin'].includes(user.role);
}

export function canEditRates(user: SessionUser | null): boolean {
  return hasMinRole(user, 'admin');
}

export function canManageCrm(user: SessionUser | null): boolean {
  return hasMinRole(user, 'admin');
}

export function requireAuth(user: SessionUser | null): SessionUser {
  if (!user) throw new AuthError('Unauthorized');
  return user;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
