import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * DTO for creating a new LegalEntity.
 */
export class CreateLegalEntityDto {
  static zodSchema = z.object({
    legalEntityId: z.string().uuid(),
    name: z.string().min(1),
    countryCode: z.string().length(2),
    registrationNumber: z.string().optional(),
  });

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  legalEntityId!: string;

  @ApiProperty({ example: 'Acme Corporation' })
  name!: string;

  @ApiProperty({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  countryCode!: string;

  @ApiProperty({ example: '123456789', required: false })
  registrationNumber?: string;
}

/**
 * DTO for updating an existing LegalEntity.
 */
export class UpdateLegalEntityDto {
  static zodSchema = z.object({
    name: z.string().min(1).optional(),
    registrationNumber: z.string().optional(),
  });

  @ApiProperty({ example: 'Acme Corp', required: false })
  name?: string;

  @ApiProperty({ example: '987654321', required: false })
  registrationNumber?: string;
}

/**
 * DTO for creating a new OrgUnit.
 */
export class CreateOrgUnitDto {
  static zodSchema = z.object({
    orgUnitId: z.string().uuid(),
    legalEntityId: z.string().uuid(),
    name: z.string().min(1),
    parentOrgUnitId: z.string().uuid().optional(),
  });

  @ApiProperty()
  orgUnitId!: string;

  @ApiProperty()
  legalEntityId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false })
  parentOrgUnitId?: string;
}

/**
 * DTO for updating an existing OrgUnit.
 */
export class UpdateOrgUnitDto {
  static zodSchema = z.object({
    name: z.string().min(1).optional(),
    parentOrgUnitId: z.string().uuid().optional(),
  });

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  parentOrgUnitId?: string;
}

/**
 * DTO for restructuring an OrgUnit.
 */
export class RestructureOrgUnitDto {
  static zodSchema = z.object({
    newParentOrgUnitId: z.string().uuid().optional(),
    newName: z.string().min(1).optional(),
  });

  @ApiProperty({ required: false })
  newParentOrgUnitId?: string;

  @ApiProperty({ required: false })
  newName?: string;
}

/**
 * DTO for assigning a manager to a worker.
 */
export class AssignManagerDto {
  static zodSchema = z.object({
    workerId: z.string().uuid(),
    managerId: z.string().uuid(),
    departmentId: z.string().uuid().optional(),
  });

  @ApiProperty()
  workerId!: string;

  @ApiProperty()
  managerId!: string;

  @ApiProperty({ required: false })
  departmentId?: string;
}
