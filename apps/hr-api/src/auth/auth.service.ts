/**
 * Local development authentication service.
 * Provides demo user accounts and JWT token management.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { loadAppConfig } from '../config/app.config.js';

export interface DemoUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

const DEMO_USERS: DemoUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    email: 'hr.admin@example.com',
    firstName: 'HR',
    lastName: 'Admin',
    passwordHash: '$2b$10$XOturYAwdImT.TMp4gkc7u0j3ZwAWzMbJViENs0C0QP5c5TYKDRF.', // Password123!
    tenantId: '00000000-0000-0000-0000-000000000001',
    roles: ['HR_ADMIN', 'COMPENSATION_ADMIN', 'BENEFITS_ADMIN'],
    permissions: [
      'WORKER_CREATE', 'WORKER_READ', 'WORKER_UPDATE', 'WORKER_TERMINATE',
      'ORGANIZATION_MANAGE', 'REPORTING_READ', 'COMPLIANCE_MANAGE',
      'PAYROLL_MANAGE', 'BENEFITS_MANAGE', 'PERFORMANCE_MANAGE',
      'LEARNING_MANAGE', 'RECRUITING_MANAGE', 'ONBOARDING_MANAGE',
      'COMPENSATION_READ', 'COMPENSATION_CHANGE', 'COMPENSATION_APPROVE',
      'BENEFITS_READ', 'BENEFITS_ENROLL', 'BENEFITS_APPROVE',
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    email: 'manager@example.com',
    firstName: 'Line',
    lastName: 'Manager',
    passwordHash: '$2b$10$XOturYAwdImT.TMp4gkc7u0j3ZwAWzMbJViENs0C0QP5c5TYKDRF.', // Password123!
    tenantId: '00000000-0000-0000-0000-000000000001',
    roles: ['MANAGER'],
    permissions: [
      'WORKER_READ', 'WORKER_UPDATE',
      'PERFORMANCE_READ', 'PERFORMANCE_WRITE',
      'TIME_ATTENDANCE_MANAGE', 'APPROVAL_MANAGE',
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    email: 'employee@example.com',
    firstName: 'Regular',
    lastName: 'Employee',
    passwordHash: '$2b$10$XOturYAwdImT.TMp4gkc7u0j3ZwAWzMbJViENs0C0QP5c5TYKDRF.', // Password123!
    tenantId: '00000000-0000-0000-0000-000000000001',
    roles: ['EMPLOYEE'],
    permissions: [
      'SELF_READ', 'SELF_UPDATE',
      'TIME_ATTENDANCE_READ', 'TIME_ATTENDANCE_WRITE',
      'BENEFITS_READ', 'PAYSLIP_READ',
    ],
  },
];

@Injectable()
export class AuthService {
  private readonly config = loadAppConfig();

  async validateCredentials(email: string, password: string): Promise<AuthUser> {
    const user = DEMO_USERS.find((u) => u.email === email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions,
        tenant_id: user.tenantId,
        actor_type: 'USER',
        mfa_authenticated: true,
      },
      this.config.jwtSecret,
      { expiresIn: this.config.jwtExpiresIn as `${number}${'s'|'m'|'h'|'d'|'w'|'y'}` },
    );
  }

  verifyToken(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, {
        clockTolerance: 30,
      }) as Record<string, unknown>;

      return {
        id: payload.sub as string,
        email: payload.email as string,
        firstName: payload.firstName as string,
        lastName: payload.lastName as string,
        tenantId: payload.tenant_id as string,
        roles: (payload.roles as string[]) ?? [],
        permissions: (payload.permissions as string[]) ?? [],
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  findById(id: string): AuthUser | undefined {
    const user = DEMO_USERS.find((u) => u.id === id);
    if (!user) return undefined;
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
    };
  }
}
