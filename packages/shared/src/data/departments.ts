/**
 * Departments, fixed in code for now (Plan 04 §2.3). When the departments module comes,
 * these keys become its seed data.
 */
export const DEPARTMENTS = [
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'front_office', label: 'Front office' },
  { key: 'maintenance', label: 'Maintenance' },
] as const;

export type DepartmentKey = (typeof DEPARTMENTS)[number]['key'];

export const DEPARTMENT_KEYS = DEPARTMENTS.map((d) => d.key) as [DepartmentKey, ...DepartmentKey[]];

export function departmentLabel(key: string): string {
  return DEPARTMENTS.find((d) => d.key === key)?.label ?? key;
}
