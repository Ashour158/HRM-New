import type {
  IntegrationAuditLogHook,
  IntegrationCredentialState,
  IntegrationIncidentState,
  IntegrationReadinessMetadata,
  IntegrationRetryPolicy,
} from './types.js';

const defaultRetryPolicy: IntegrationRetryPolicy = {
  maxAttempts: 3,
  backoff: 'EXPONENTIAL',
  initialDelayMs: 500,
  maxDelayMs: 30_000,
  deadLetterAfterAttempts: 3,
};

const defaultAuditLogHooks: IntegrationAuditLogHook[] = [
  'HEALTH_CHECK',
  'SEND_ATTEMPT',
  'SEND_SUCCESS',
  'SEND_FAILURE',
  'INCIDENT_STATE_CHANGED',
];

interface ReadinessMetadataOptions {
  ownerTeam: string;
  ownerContact: string;
  sandboxEndpointRef: string;
  productionEndpointRef: string;
  credentialRefBase: string;
  credentialState?: IntegrationCredentialState;
  retryPolicy?: Partial<IntegrationRetryPolicy>;
  auditLogHooks?: IntegrationAuditLogHook[];
  incident?: IntegrationIncidentState;
}

export function createReadinessMetadata(options: ReadinessMetadataOptions): IntegrationReadinessMetadata {
  const credentialState = options.credentialState ?? 'NOT_CONFIGURED';

  return {
    owner: {
      team: options.ownerTeam,
      contact: options.ownerContact,
    },
    environments: [
      {
        name: 'SANDBOX',
        endpointRef: options.sandboxEndpointRef,
        credentialRef: `${options.credentialRefBase}/sandbox`,
        credentialState,
      },
      {
        name: 'PRODUCTION',
        endpointRef: options.productionEndpointRef,
        credentialRef: `${options.credentialRefBase}/production`,
        credentialState,
      },
    ],
    retryPolicy: {
      ...defaultRetryPolicy,
      ...options.retryPolicy,
    },
    auditLogHooks: options.auditLogHooks ?? defaultAuditLogHooks,
    incident: options.incident ?? { state: 'NONE' },
  };
}
