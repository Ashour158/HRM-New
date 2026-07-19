export type ApprovalConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_OR_EQUAL'
  | 'LESS_OR_EQUAL'
  | 'CONTAINS';

export const APPROVAL_CONDITION_OPERATORS: Array<{ value: ApprovalConditionOperator; label: string }> = [
  { value: 'EQUALS', label: 'Equals' },
  { value: 'NOT_EQUALS', label: 'Not equals' },
  { value: 'GREATER_THAN', label: 'Greater than' },
  { value: 'LESS_THAN', label: 'Less than' },
  { value: 'GREATER_OR_EQUAL', label: 'Greater or equal' },
  { value: 'LESS_OR_EQUAL', label: 'Less or equal' },
  { value: 'CONTAINS', label: 'Contains' },
];
