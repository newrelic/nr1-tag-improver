const TAG_SCHEMA_ENFORCEMENT = {
  required: 'required',
  optional: 'optional',
  deprecated: 'deprecated', // reserved for future use
  prohibited: 'prohibited' // reserved for future use
};

const ENFORCEMENT_PRIORITY = {
  [TAG_SCHEMA_ENFORCEMENT.required]: 0,
  [TAG_SCHEMA_ENFORCEMENT.optional]: 1,
  [TAG_SCHEMA_ENFORCEMENT.deprecated]: 2,
  [TAG_SCHEMA_ENFORCEMENT.prohibited]: 3
};

const COMPLIANCEBANDS = {
  // rule: the lowerLimit always falls within the range
  highBand: { upperLimit: 100, lowerLimit: 67, color: 'seagreen' },
  midBand: { upperLimit: 67, lowerLimit: 33, color: 'sandybrown' },
  lowBand: { upperLimit: 33, lowerLimit: 0, color: 'orangered' }
};

const SCHEMA = [
  {
    key: 'team',
    purpose: 'What is the team or squad that is responsible for this entity?',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [] // reserved for future use
  },
  {
    key: 'owner',
    purpose:
      'What is the email or primary identifier of the individual (ex. team lead or primary contributor) who owns this entity?',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [] // reserved for future use
  },
  {
    key: 'help-channel',
    purpose:
      'What is the identifier/URL of the primary communication channel for requesting help or additional info for this entity?',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [] // reserved for future use
  },
  {
    key: 'repository',
    purpose:
      'What is the identifier/URL of the repository for the source code, image, or configuration file for this entity?',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [] // reserved for future use
  },
  {
    key: 'runbook',
    purpose:
      'What is the identifier/URL of the runbook or wiki that documents this entity and relevant/associated processes?',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [] // reserved for future use
  },
  {
    key: 'environment',
    purpose:
      'What is the environment in which this entity exists?  (ex. production, quality-assurance, development, etc.)',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [] // reserved for future use
  },
  {
    key: 'value-stream',
    purpose: 'What is the business value stream, application, or functional area that this entity is a part of, to deliver business value to users?',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [] // reserved for future use
  }
];

const ENTITY_TYPES = [
  // { id: "ALL", name: "All Entity Types", value: "ALL_ENTITIES" },
  { id: 'APM', name: 'Application', value: 'APM_APPLICATION_ENTITY' },
  { id: 'BROWSER', name: 'Browser', value: 'BROWSER_APPLICATION_ENTITY' },
  { id: 'MOBILE', name: 'Mobile', value: 'MOBILE_APPLICATION_ENTITY' },
  { id: 'INFRA', name: 'Infrastructure', value: 'INFRASTRUCTURE_HOST_ENTITY' },
  { id: 'SYNTH', name: 'Synthetic', value: 'SYNTHETIC_MONITOR_ENTITY' },
  { id: 'VIZ', name: 'Dashboard', value: 'DASHBOARD_ENTITY' },
  { id: 'NR1', name: 'Workload', value: 'WORKLOAD_ENTITY' }
];

export {
  SCHEMA,
  TAG_SCHEMA_ENFORCEMENT,
  ENFORCEMENT_PRIORITY,
  COMPLIANCEBANDS,
  ENTITY_TYPES
};
