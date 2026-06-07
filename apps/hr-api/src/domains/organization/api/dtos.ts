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
    newParentOrgUnitId: z.string().uuid().nullable().optional(),
    newName: z.string().min(1).optional(),
  });

  @ApiProperty({ required: false, nullable: true })
  newParentOrgUnitId?: string | null;

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

/**
 * DTO for assigning a worker into the organization structure.
 */
export class AssignWorkerOrganizationDto {
  static zodSchema = z.object({
    legalEntityId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    managerId: z.string().uuid().nullable().optional(),
    jobTitle: z.string().min(1).nullable().optional(),
  });

  @ApiProperty({ required: false, nullable: true })
  legalEntityId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  departmentId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  managerId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  jobTitle?: string | null;
}

/**
 * Public API DTO for assigning a worker into the organization structure.
 */
export class AssignWorkerOrganizationByBodyDto extends AssignWorkerOrganizationDto {
  static zodSchema = AssignWorkerOrganizationDto.zodSchema.extend({
    workerId: z.string().uuid(),
  });

  @ApiProperty()
  workerId!: string;
}

/**
 * DTO for simulating strategic workforce planning scenarios.
 */
export class WorkforceScenarioDto {
  static zodSchema = z.object({
    name: z.string().min(1).optional(),
    branchExpansionCount: z.number().int().min(0).max(100).optional(),
    rolesPerBranch: z.number().int().min(0).max(1000).optional(),
    adminReductionPercent: z.number().min(0).max(100).optional(),
    outsourceHeadcount: z.number().int().min(0).max(100000).optional(),
    demandGrowthPercent: z.number().min(-100).max(500).optional(),
    automationOffsetPercent: z.number().min(0).max(100).optional(),
    aiAgentCapacity: z.number().int().min(0).max(100000).optional(),
    averageCostPerFte: z.number().min(0).optional(),
  });

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false, example: 3 })
  branchExpansionCount?: number;

  @ApiProperty({ required: false, example: 12 })
  rolesPerBranch?: number;

  @ApiProperty({ required: false, example: 10 })
  adminReductionPercent?: number;

  @ApiProperty({ required: false, example: 8 })
  outsourceHeadcount?: number;

  @ApiProperty({ required: false, example: 15 })
  demandGrowthPercent?: number;

  @ApiProperty({ required: false, example: 5 })
  automationOffsetPercent?: number;

  @ApiProperty({ required: false, example: 4 })
  aiAgentCapacity?: number;

  @ApiProperty({ required: false, example: 36000 })
  averageCostPerFte?: number;
}
