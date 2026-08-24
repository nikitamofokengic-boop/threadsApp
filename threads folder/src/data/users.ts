import { User, UserRole, RolePermissions } from '../types';

export const USERS: (User & { password: string })[] = [
  {
    username: 'superadmin',
    password: 'superadmin123',
    name: 'Super Admin (Root)',
    role: 'super_admin',
    roleName: 'Super Administrator'
  }
];

export const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  super_admin: {
    roleId: 'super_admin',
    roleName: 'Super Administrator',
    allowedTabs: ['summary', 'monthly_summary', 'headcount', 'subsidies', 'earnings', 'payroll', 'overheads', 'changes', 'admin'],
    canEditHeadcount: true,
    canEditWages: true,
    canEditEarnings: true,
    canEditSAH: true,
    canEditOverheads: true,
    canAddDeleteDates: true,
    canManageRoles: true
  }
};

