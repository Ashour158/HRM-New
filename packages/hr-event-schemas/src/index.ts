/**
 * @hcm/event-schemas
 *
 * Canonical event types and schemas for the HR/HCM platform's event nervous system.
 */

// Core primitives
export * from './core/event-envelope.js';
export * from './core/event-privacy.js';
export * from './core/topic-registry.js';

// Domain events
export * from './events/core-events.js';
export * from './events/organization-events.js';
export * from './events/position-events.js';
export * from './events/recruiting-events.js';
export * from './events/payroll-events.js';
export * from './events/benefits-events.js';
export * from './events/absence-events.js';
export * from './events/time-events.js';
export * from './events/performance-events.js';
export * from './events/compliance-events.js';
export * from './events/country-policy-events.js';

// Utilities
export * from './utils/event-factory.js';
