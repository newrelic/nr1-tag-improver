const TAG_SCHEMA_ENFORCEMENT = {
  required: 'required',
  recommended: 'recommended',
  optional: 'optional',
  deprecated: 'deprecated', // reserved for future use
  prohibited: 'prohibited' // reserved for future use
};

const ENFORCEMENT_PRIORITY = {
  [TAG_SCHEMA_ENFORCEMENT.required]: 0,
  [TAG_SCHEMA_ENFORCEMENT.recommended]: 1,
  [TAG_SCHEMA_ENFORCEMENT.optional]: 2,
  [TAG_SCHEMA_ENFORCEMENT.deprecated]: 3,
  [TAG_SCHEMA_ENFORCEMENT.prohibited]: 4
};

const SCHEMA = [
  {
    label: 'Owning team',
    key: 'Team',
    purpose: '',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [] // reserved for future use
  },
  {
    label: 'Region',
    key: 'Environment',
    purpose: '',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [] // reserved for future use
  },
  {
    label: 'Owning VP',
    key: 'VP',
    purpose: '',
    enforcement: TAG_SCHEMA_ENFORCEMENT.recommended,
    allowedValues: [] // reserved for future use
  },
  {
    label: 'Source code repo',
    key: 'Project',
    purpose: '',
    enforcement: TAG_SCHEMA_ENFORCEMENT.recommended,
    allowedValues: [] // reserved for future use
  },
  {
    label: 'Canary deploy',
    key: 'Canary',
    purpose: '',
    enforcement: TAG_SCHEMA_ENFORCEMENT.optional,
    allowedValues: [] // reserved for future use
  }
];

export { SCHEMA, TAG_SCHEMA_ENFORCEMENT, ENFORCEMENT_PRIORITY };
