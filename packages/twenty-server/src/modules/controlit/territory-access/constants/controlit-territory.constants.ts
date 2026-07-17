export const CONTROLIT_TERRITORIES = [
  'FINLAND',
  'ESTONIA',
  'LITHUANIA',
  'LATVIA',
  'UNITED_ARAB_EMIRATES',
  'ASIA',
  'CZECHIA',
  'SLOVAKIA',
  'SLOVENIA',
  'CROATIA',
  'ROMANIA',
  'HUNGARY',
  'MENA',
  'AUSTRALIA',
  'NEW_ZEALAND',
  'UNITED_KINGDOM',
  'KUWAIT',
  'SWEDEN',
  'NETHERLANDS',
  'USA',
  'EUROPE',
  'IRELAND',
  'SERBIA',
  'BELGIUM',
  'TURKEY',
] as const;

export type ControlitTerritory = (typeof CONTROLIT_TERRITORIES)[number];

export const CONTROLIT_TERRITORY_FIELD_BY_OBJECT = {
  company: 'companyCountry',
  note: 'noteTerritory',
  person: 'personTerritory',
  opportunity: 'projectCountry',
  task: 'taskTerritory',
} as const;

export type ControlitRestrictedObjectName =
  keyof typeof CONTROLIT_TERRITORY_FIELD_BY_OBJECT;

export const CONTROLIT_RESTRICTED_OBJECTS = Object.keys(
  CONTROLIT_TERRITORY_FIELD_BY_OBJECT,
) as ControlitRestrictedObjectName[];

export const CONTROLIT_NO_RECORD_ID = '00000000-0000-0000-0000-000000000000';
