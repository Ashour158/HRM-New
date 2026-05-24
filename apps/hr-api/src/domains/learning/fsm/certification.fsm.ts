import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerCertificationFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'Certification',
    states: ['ACTIVE', 'EXPIRED', 'RENEWED', 'REVOKED'],
    actions: ['CreateCertification', 'RenewCertification', 'ExpireCertification', 'RevokeCertification'],
    transitions: [
      { action: 'CreateCertification', from: 'ACTIVE', to: 'ACTIVE', eventName: 'CertificationGranted' },
      { action: 'RenewCertification', from: 'ACTIVE', to: 'RENEWED', eventName: 'CertificationRenewed' },
      { action: 'RenewCertification', from: 'EXPIRED', to: 'RENEWED', eventName: 'CertificationRenewed' },
      { action: 'ExpireCertification', from: 'ACTIVE', to: 'EXPIRED', eventName: 'CertificationExpired' },
      { action: 'ExpireCertification', from: 'RENEWED', to: 'EXPIRED', eventName: 'CertificationExpired' },
      { action: 'RevokeCertification', from: 'ACTIVE', to: 'REVOKED', eventName: 'CertificationRevoked' },
      { action: 'RevokeCertification', from: 'EXPIRED', to: 'REVOKED', eventName: 'CertificationRevoked' },
      { action: 'RevokeCertification', from: 'RENEWED', to: 'REVOKED', eventName: 'CertificationRevoked' },
    ],
    initialState: 'ACTIVE',
    terminalStates: ['REVOKED'],
  };
  fsm.register(definition);
}
