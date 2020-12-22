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
  // rule: the loverlimit always falls within the range
  highBand: { upperLimit: 100, lowerLimit: 67, color: 'seagreen' },
  midBand: { upperLimit: 67, lowerLimit: 33, color: 'sandybrown' },
  lowBand: { upperLimit: 33, lowerLimit: 0, color: 'orangered' }
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
    enforcement: TAG_SCHEMA_ENFORCEMENT.optional,
    allowedValues: [] // reserved for future use
  },
  {
    label: 'Source code repo',
    key: 'Project',
    purpose: '',
    enforcement: TAG_SCHEMA_ENFORCEMENT.optional,
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

const ENTITY_TYPES = [
  // { id: "all", name: "All Entity Types", value: "ALL_ENTITIES" },
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
