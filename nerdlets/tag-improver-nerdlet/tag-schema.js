const TAG_SCHEMA_ENFORCEMENT = {
  required: 'required',
  optional: 'optional',
  deprecated: 'deprecated', // reserved for future use
  prohibited: 'prohibited', // reserved for future use
};

const ENFORCEMENT_PRIORITY = {
  [TAG_SCHEMA_ENFORCEMENT.required]: 0,
  [TAG_SCHEMA_ENFORCEMENT.optional]: 1,
  [TAG_SCHEMA_ENFORCEMENT.deprecated]: 2,
  [TAG_SCHEMA_ENFORCEMENT.prohibited]: 3,
};

const COMPLIANCEBANDS = {
  // rule: the lowerLimit always falls within the range
  highBand: { upperLimit: 100, lowerLimit: 67, color: 'seagreen' },
  midBand: { upperLimit: 67, lowerLimit: 33, color: 'sandybrown' },
  lowBand: { upperLimit: 33, lowerLimit: 0, color: 'orangered' },
};

const SCHEMA = [
  {
    key: 'ApplicationName',
    purpose: 'able to identify affected apps',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [], // reserved for future use
  },
  {
    key: 'EnvironmentType',
    purpose:
      'able to confirm if PROD environment or not',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [], // reserved for future use
  },
  {
    key: 'ServiceName',
    purpose:
      'able to identify affected services',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [], // reserved for future use
  },
  {
    key: 'Priority',
    purpose:
      'able to identify if critical app or service',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [], // reserved for future use
  },
  {
    key: 'Owner',
    purpose:
        'able to identify squad responsible for service/app',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [], // reserved for future use
  },
  {
    key: 'DomainName',
    purpose:
        'able to identify the domain',
    enforcement: TAG_SCHEMA_ENFORCEMENT.required,
    allowedValues: [], // reserved for future use
  }
];

const ENTITY_TYPES = [
  {
    attribute: 'type',
    id: 'CONDITION',
    name: 'Alert Condition',
  },
  {
    attribute: 'domain',
    id: 'APM',
    name: 'APM Service',
  },
  {
    attribute: 'domain',
    id: 'BROWSER',
    name: 'Browser',
  },
  {
    attribute: 'domain',
    id: 'VIZ',
    name: 'Dashboard',
  },
  {
    attribute: 'domain',
    id: 'INFRA',
    name: 'Infrastructure',
  },
  {
    attribute: 'domain',
    id: 'MOBILE',
    name: 'Mobile',
  },
  {
    attribute: 'type',
    id: 'SERVICE',
    name: 'OTEL Service',
  },
  {
    attribute: 'domain',
    id: 'SYNTH',
    name: 'Synthetic',
  },
  {
    attribute: 'type',
    id: 'WORKFLOW',
    name: 'Workflow',
  },
  {
    attribute: 'domain',
    id: 'NR1',
    name: 'Workload',
  },
];

export {
  SCHEMA,
  TAG_SCHEMA_ENFORCEMENT,
  ENFORCEMENT_PRIORITY,
  COMPLIANCEBANDS,
  ENTITY_TYPES,
};
