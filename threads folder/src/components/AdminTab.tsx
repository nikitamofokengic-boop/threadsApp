import React, { useState } from 'react';
import { User, RolePermissions } from '../types';
import ConfirmModal from './ConfirmModal';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Plus, 
  Key, 
  UserPlus, 
  Lock, 
  Trash2, 
  CheckCircle2, 
  Cloud, 
  Users, 
  Sparkles, 
  Edit3, 
  Sliders,
  Eye,
  EyeOff,
  Pencil,
  Save,
  Copy,
  Database
} from 'lucide-react';

interface AdminTabProps {
  currentUser: User;
  usersList: (User & { password?: string })[];
  rolePermissionsMap: Record<string, RolePermissions>;
  onUpdateRolePermissions: (newMap: Record<string, RolePermissions>) => void;
  onUpdateUsersList: (newUsers: (User & { password?: string })[]) => void;
  firebaseConnected: boolean;
}

const ALL_TAB_KEYS = [
  { id: 'summary', label: 'Daily Operations' },
  { id: 'monthly_summary', label: 'Monthly Analytics & Charts' },
  { id: 'headcount', label: 'Labor Headcount' },
  { id: 'subsidies', label: 'Other Subsidies & Allocations' },
  { id: 'earnings', label: 'Style CM Earnings' },
  { id: 'payroll', label: 'Payroll Schedule' },
  { id: 'overheads', label: 'Overhead Expenses' },
  { id: 'changes', label: 'Shift Changes' },
  { id: 'admin', label: 'Admin Panel' }
];

const DEPT_OPTIONS = ['ALL DEPARTMENTS', 'CUTTING', 'PRODUCTION FLOOR', 'QC', 'FABRIC ROOM', 'SAMPLE ROOM', 'PACKING', 'AFTERWASHING', 'MAINTENANCE', 'NONE'];

export default function AdminTab({
  currentUser,
  usersList,
  rolePermissionsMap,
  onUpdateRolePermissions,
  onUpdateUsersList,
  firebaseConnected
}: AdminTabProps) {
  if (currentUser.role !== 'super_admin') {
    return (
      <div className="bg-white p-8 rounded-3xl border border-rose-200 shadow-md text-center max-w-xl mx-auto my-12">
        <div className="inline-flex items-center justify-center p-4 bg-rose-100 text-rose-600 rounded-2xl mb-4">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">Access Restricted: Super Administrator Required</h2>
        <p className="text-sm text-slate-600 font-medium leading-relaxed mb-6">
          Safety Protection: Only the <strong>Super Administrator</strong> is authorized to view or access other user accounts, reset passwords, edit roles, or manage system security settings.
        </p>
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
          Logged in as: {currentUser.name} (@{currentUser.username}) • Role: {currentUser.roleName || currentUser.role}
        </div>
      </div>
    );
  }

  const [selectedRoleId, setSelectedRoleId] = useState<string>('super_admin');
  const [activeSubTab, setActiveSubTab] = useState<'roles' | 'users' | 'security'>('roles');

  // New Role Form State
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleIdKey, setNewRoleIdKey] = useState('');
  const [templateRoleId, setTemplateRoleId] = useState<string>('super_admin');
  const [newRoleTabs, setNewRoleTabs] = useState<string[]>(['summary', 'monthly_summary', 'headcount', 'changes']);
  const [newRoleCanEditHc, setNewRoleCanEditHc] = useState<boolean | string>(false);
  const [newRoleCanEditWages, setNewRoleCanEditWages] = useState<boolean>(false);
  const [newRoleCanEditEarnings, setNewRoleCanEditEarnings] = useState<boolean>(false);
  const [newRoleCanEditSah, setNewRoleCanEditSah] = useState<boolean>(false);
  const [newRoleCanEditOverheads, setNewRoleCanEditOverheads] = useState<boolean>(false);
  const [newRoleCanAddDeleteDates, setNewRoleCanAddDeleteDates] = useState<boolean>(false);
  const [newRoleCanManageRoles, setNewRoleCanManageRoles] = useState<boolean>(false);

  // New User Form State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('super_admin');
  const [newUserDept, setNewUserDept] = useState('');

  // Edit User Form State
  const [editingUser, setEditingUser] = useState<(User & { password?: string }) | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserDept, setEditUserDept] = useState('');

  // Password Visibility Toggle for Table
  const [showPasswordsMap, setShowPasswordsMap] = useState<Record<string, boolean>>({});

  const [notification, setNotification] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<{ roleKey: string; roleName: string; assignedCount: number } | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const togglePasswordVisibility = (username: string) => {
    setShowPasswordsMap(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  const activeRolePerms = rolePermissionsMap[selectedRoleId] || {
    roleId: selectedRoleId,
    roleName: selectedRoleId.toUpperCase(),
    allowedTabs: ['summary', 'monthly_summary'],
    canEditHeadcount: false,
    canEditWages: false,
    canEditEarnings: false,
    canEditSAH: false,
    canEditOverheads: false,
    canAddDeleteDates: false,
    canManageRoles: false
  };

  // Rename Role Title
  const handleRenameRole = (roleKey: string, newName: string) => {
    const updatedMap = {
      ...rolePermissionsMap,
      [roleKey]: {
        ...(rolePermissionsMap[roleKey] || activeRolePerms),
        roleName: newName
      }
    };
    onUpdateRolePermissions(updatedMap);

    // Sync updated roleName to any users having this role
    const updatedUsers = usersList.map(u => 
      u.role === roleKey ? { ...u, roleName: newName } : u
    );
    onUpdateUsersList(updatedUsers);
  };

  // Delete Role permanently
  const handleDeleteRole = (roleKey: string) => {
    const keys = Object.keys(rolePermissionsMap);
    if (keys.length <= 1) {
      alert("Cannot delete the only remaining role in the system.");
      return;
    }
    if (roleKey === 'super_admin') {
      alert("The Super Administrator root role cannot be deleted.");
      return;
    }

    const assignedUsers = usersList.filter(u => u.role === roleKey);
    const assignedCount = assignedUsers.length;
    const roleNameStr = rolePermissionsMap[roleKey]?.roleName || roleKey;

    setRoleToDelete({ roleKey, roleName: roleNameStr, assignedCount });
  };

  const executeDeleteRole = (roleKey: string) => {
    const newMap = { ...rolePermissionsMap };
    delete newMap[roleKey];

    const fallbackRoleKey = 'super_admin' in newMap ? 'super_admin' : Object.keys(newMap)[0];
    const fallbackRoleObj = newMap[fallbackRoleKey];

    const updatedUsers = usersList.map(u => {
      if (u.role !== roleKey) return u;
      return {
        ...u,
        role: fallbackRoleKey,
        roleName: fallbackRoleObj?.roleName || fallbackRoleKey
      };
    });

    onUpdateRolePermissions(newMap);
    onUpdateUsersList(updatedUsers);

    if (selectedRoleId === roleKey) {
      setSelectedRoleId(fallbackRoleKey);
    }
    showFeedback(`Role "${roleToDelete?.roleName || roleKey}" permanently deleted from Cloud Firestore & local storage.`);
  };

  // Toggle Tab Access
  const handleToggleTab = (tabId: string) => {
    const currentTabs = [...(activeRolePerms.allowedTabs || [])];
    const exists = currentTabs.includes(tabId);
    let updatedTabs: string[];

    if (exists) {
      updatedTabs = currentTabs.filter(t => t !== tabId);
    } else {
      updatedTabs = [...currentTabs, tabId];
    }

    const updatedMap = {
      ...rolePermissionsMap,
      [selectedRoleId]: {
        ...activeRolePerms,
        allowedTabs: updatedTabs
      }
    };

    onUpdateRolePermissions(updatedMap);
    showFeedback(`Updated tab access for role: ${activeRolePerms.roleName || selectedRoleId}`);
  };

  // Toggle Single Permission Boolean
  const handleTogglePerm = (key: keyof RolePermissions, value: boolean) => {
    const updatedMap = {
      ...rolePermissionsMap,
      [selectedRoleId]: {
        ...activeRolePerms,
        [key]: value
      }
    };

    onUpdateRolePermissions(updatedMap);
    showFeedback(`Updated permission (${String(key)}) for role: ${activeRolePerms.roleName || selectedRoleId}`);
  };

  // Change Headcount Edit Level
  const handleHeadcountEditChange = (value: string) => {
    let permVal: boolean | string = false;
    if (value === 'ALL') permVal = true;
    else if (value === 'NONE') permVal = false;
    else permVal = value;

    const updatedMap = {
      ...rolePermissionsMap,
      [selectedRoleId]: {
        ...activeRolePerms,
        canEditHeadcount: permVal
      }
    };

    onUpdateRolePermissions(updatedMap);
    showFeedback(`Headcount edit permission set to: ${value}`);
  };

  // Explicitly Save & Store All Roles
  const handleSaveAllRoles = () => {
    onUpdateRolePermissions(rolePermissionsMap);
    showFeedback("Roles Matrix successfully saved & stored in Cloud Firestore & Local Storage!");
  };

  // Explicitly Save & Store All User Accounts
  const handleSaveAllUsers = () => {
    onUpdateUsersList(usersList);
    showFeedback("All User Accounts successfully saved & synced to Cloud Firestore & Local Storage!");
  };

  // Duplicate Existing Role
  const handleDuplicateRole = (sourceKey: string) => {
    const sourceObj = rolePermissionsMap[sourceKey] || activeRolePerms;
    const sourceName = sourceObj.roleName || sourceKey;

    let dupTitle = `Copy of ${sourceName}`;
    let counter = 1;
    let dupKey = `${sourceKey}_copy`;

    while (rolePermissionsMap[dupKey]) {
      counter++;
      dupTitle = `Copy ${counter} of ${sourceName}`;
      dupKey = `${sourceKey}_copy_${counter}`;
    }

    const duplicatedRole: RolePermissions = {
      ...sourceObj,
      roleId: dupKey,
      roleName: dupTitle
    };

    const updatedMap = {
      ...rolePermissionsMap,
      [dupKey]: duplicatedRole
    };

    onUpdateRolePermissions(updatedMap);
    setSelectedRoleId(dupKey);
    showFeedback(`Duplicated & stored new role "${dupTitle}"!`);
  };

  // Pre-fill modal states when user chooses a template role
  const handleSelectTemplate = (tmplKey: string) => {
    setTemplateRoleId(tmplKey);
    if (tmplKey && rolePermissionsMap[tmplKey]) {
      const tmpl = rolePermissionsMap[tmplKey];
      setNewRoleTabs([...(tmpl.allowedTabs || [])]);
      setNewRoleCanEditHc(tmpl.canEditHeadcount);
      setNewRoleCanEditWages(!!tmpl.canEditWages);
      setNewRoleCanEditEarnings(!!tmpl.canEditEarnings);
      setNewRoleCanEditSah(!!tmpl.canEditSAH);
      setNewRoleCanEditOverheads(!!tmpl.canEditOverheads);
      setNewRoleCanAddDeleteDates(!!tmpl.canAddDeleteDates);
      setNewRoleCanManageRoles(!!tmpl.canManageRoles);
    }
  };

  const handleToggleNewRoleTab = (tabId: string) => {
    setNewRoleTabs(prev => 
      prev.includes(tabId) ? prev.filter(t => t !== tabId) : [...prev, tabId]
    );
  };

  // Create New Custom Role
  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleTitle.trim()) return;

    const key = (newRoleIdKey.trim() || newRoleTitle.trim().toLowerCase().replace(/\s+/g, '_')).replace(/[^a-z0-9_]/gi, '');
    if (rolePermissionsMap[key]) {
      alert("A role with this ID key already exists.");
      return;
    }

    const newRole: RolePermissions = {
      roleId: key,
      roleName: newRoleTitle.trim(),
      allowedTabs: newRoleTabs.length > 0 ? newRoleTabs : ['summary', 'monthly_summary'],
      canEditHeadcount: newRoleCanEditHc,
      canEditWages: newRoleCanEditWages,
      canEditEarnings: newRoleCanEditEarnings,
      canEditSAH: newRoleCanEditSah,
      canEditOverheads: newRoleCanEditOverheads,
      canAddDeleteDates: newRoleCanAddDeleteDates,
      canManageRoles: newRoleCanManageRoles
    };

    const updatedMap = {
      ...rolePermissionsMap,
      [key]: newRole
    };

    onUpdateRolePermissions(updatedMap);
    setSelectedRoleId(key);
    setShowAddRoleModal(false);
    setNewRoleTitle('');
    setNewRoleIdKey('');
    showFeedback(`New role "${newRoleTitle.trim()}" created, saved & stored successfully!`);
  };

  // Create New User Account
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newFullName.trim()) return;

    if (usersList.some(u => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      alert("Username already exists.");
      return;
    }

    const roleObj = rolePermissionsMap[newUserRole];

    const newUserObj = {
      username: newUsername.trim().toLowerCase(),
      name: newFullName.trim(),
      password: newUserPassword.trim() || 'password123',
      role: newUserRole,
      roleName: roleObj?.roleName || newUserRole,
      deptAccess: newUserDept.trim() || undefined
    };

    const updatedUsers = [...usersList, newUserObj];
    onUpdateUsersList(updatedUsers);

    setShowAddUserModal(false);
    setNewUsername('');
    setNewFullName('');
    setNewUserPassword('');
    setNewUserDept('');
    showFeedback(`User account "${newFullName}" created!`);
  };

  // Open Edit User Modal
  const handleOpenEditUser = (u: User & { password?: string }) => {
    setEditingUser(u);
    setEditFullName(u.name);
    setEditUsername(u.username);
    setEditUserPassword(u.password || '');
    setEditUserRole(u.role);
    setEditUserDept(u.deptAccess || '');
  };

  // Save Edited User Account
  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editFullName.trim() || !editUsername.trim()) return;

    const existingTarget = usersList.find(u => u.username.toLowerCase() === editUsername.trim().toLowerCase() && u.username !== editingUser.username);
    if (existingTarget) {
      alert("Another account with this username already exists.");
      return;
    }

    const roleObj = rolePermissionsMap[editUserRole];

    const updatedUsers = usersList.map(u => {
      if (u.username !== editingUser.username) return u;
      return {
        ...u,
        username: editUsername.trim().toLowerCase(),
        name: editFullName.trim(),
        password: editUserPassword.trim() || 'password123',
        role: editUserRole,
        roleName: roleObj?.roleName || editUserRole,
        deptAccess: editUserDept.trim() || undefined
      };
    });

    onUpdateUsersList(updatedUsers);
    setEditingUser(null);
    showFeedback(`User account "${editFullName}" updated successfully.`);
  };

  // Change existing user's role inline
  const handleUserRoleChange = (username: string, newRoleKey: string) => {
    const roleObj = rolePermissionsMap[newRoleKey];
    const updatedUsers = usersList.map(u => {
      if (u.username !== username) return u;
      return {
        ...u,
        role: newRoleKey,
        roleName: roleObj?.roleName || newRoleKey
      };
    });
    onUpdateUsersList(updatedUsers);
    showFeedback(`Role for ${username} updated to ${roleObj?.roleName || newRoleKey}`);
  };

  // Delete User Account
  const handleDeleteUser = (username: string) => {
    if (username === currentUser.username) {
      alert("You cannot delete your own logged-in account.");
      return;
    }
    setUserToDelete(username);
  };

  const executeDeleteUser = (username: string) => {
    const updatedUsers = usersList.filter(u => u.username !== username);
    onUpdateUsersList(updatedUsers);
    showFeedback(`User account "${username}" removed.`);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner / Header */}
      <div className="bento-card p-6 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-white border-pink-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-pink-600 to-rose-600 rounded-2xl text-white shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">System Security & Access Controls (RBAC)</h2>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-extrabold uppercase font-mono">
                  Super Admin Root Enabled
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Manage factory staff roles, edit fine-grained permissions, update user credentials, or delete obsolete profiles.
              </p>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-pink-200 rounded-xl shadow-2xs">
              <Cloud className={`w-4 h-4 ${firebaseConnected ? 'text-emerald-500' : 'text-amber-500'}`} />
              <div className="text-[11px]">
                <span className="font-bold text-slate-700 block leading-tight">Firebase Cloud Sync</span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {firebaseConnected ? 'Connected & Security Rules Live' : 'Local Fallback Sync Active'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-2 mt-6 border-t border-pink-100 pt-4 flex-wrap">
          <button
            onClick={() => setActiveSubTab('roles')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'roles' 
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs' 
                : 'bg-white border border-pink-200 text-slate-700 hover:bg-pink-50'
            }`}
          >
            <Sliders className="w-4 h-4" /> Role Permissions Matrix
          </button>

          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'users' 
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs' 
                : 'bg-white border border-pink-200 text-slate-700 hover:bg-pink-50'
            }`}
          >
            <Users className="w-4 h-4" /> User Accounts ({usersList.length})
          </button>

          <button
            onClick={() => setActiveSubTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'security' 
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs' 
                : 'bg-white border border-pink-200 text-slate-700 hover:bg-pink-50'
            }`}
          >
            <Lock className="w-4 h-4" /> Cloud Security Rules
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* SUB-TAB 1: ROLE PERMISSIONS MATRIX */}
      {activeSubTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Roles Selector List Sidebar */}
          <div className="lg:col-span-1 bento-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <span className="text-xs font-extrabold uppercase text-pink-700 tracking-wider">Select Role to Edit</span>
              <button
                onClick={() => setShowAddRoleModal(true)}
                className="p-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Create New Role"
              >
                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add Role</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {Object.keys(rolePermissionsMap).map((roleKey) => {
                const roleObj = rolePermissionsMap[roleKey];
                const isSelected = selectedRoleId === roleKey;
                const isRoot = roleKey === 'super_admin';
                return (
                  <div
                    key={roleKey}
                    className={`w-full p-3 rounded-2xl transition border flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-gradient-to-r from-pink-600 to-rose-600 border-rose-600 text-white shadow-xs'
                        : 'bg-white border-pink-100 hover:border-pink-300 text-slate-800 hover:bg-pink-50/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRoleId(roleKey)}
                      className="flex-1 text-left cursor-pointer min-w-0"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-extrabold text-xs truncate">{roleObj?.roleName || roleKey}</div>
                        {isRoot && (
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0 ${isSelected ? 'bg-white text-pink-700' : 'bg-pink-100 text-pink-800'}`}>
                            ROOT
                          </span>
                        )}
                      </div>
                      <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-pink-100' : 'text-slate-400'}`}>
                        Key: {roleKey} • {roleObj?.allowedTabs?.length || 0} tabs
                      </div>
                    </button>

                    {!isRoot && Object.keys(rolePermissionsMap).length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(roleKey);
                        }}
                        className={`p-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                          isSelected
                            ? 'bg-white/20 hover:bg-white/30 text-white'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                        }`}
                        title={`Permanently delete role "${roleObj?.roleName || roleKey}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Role Permissions Editor Panel */}
          <div className="lg:col-span-3 bento-card p-6 space-y-6">
            
            {/* Editable Role Header & Action Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-pink-50/70 p-4 rounded-2xl border border-pink-200">
              <div className="flex-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1">
                  Role Title / Display Name
                </label>
                <input
                  type="text"
                  value={activeRolePerms.roleName || ''}
                  onChange={(e) => handleRenameRole(selectedRoleId, e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-pink-300 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  placeholder="e.g. Quality Control Supervisor"
                />
              </div>

              <div className="flex items-center gap-2 self-start sm:self-end flex-wrap">
                <span className="px-3 py-2 bg-white text-slate-700 rounded-xl text-xs font-mono font-bold border border-pink-200">
                  ID: {selectedRoleId}
                </span>

                <button
                  type="button"
                  onClick={() => handleDuplicateRole(selectedRoleId)}
                  className="px-3.5 py-2 bg-pink-100 hover:bg-pink-200 text-pink-900 border border-pink-300 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Duplicate Role"
                >
                  <Copy className="w-3.5 h-3.5 text-pink-700" /> Duplicate
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllRoles}
                  className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Save and Store Role Settings"
                >
                  <Save className="w-3.5 h-3.5 text-white" /> Save & Store
                </button>

                {selectedRoleId !== 'super_admin' && Object.keys(rolePermissionsMap).length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(selectedRoleId)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Delete Role"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" /> Delete Role
                  </button>
                )}
              </div>
            </div>

            {/* Section A: Tab Access Permissions */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500" /> Accessible Navigation Tabs
              </h4>
              <p className="text-[11px] text-slate-500">Toggle which tabs users with this role can view in their main navigation bar.</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ALL_TAB_KEYS.map((tab) => {
                  const isAllowed = activeRolePerms.allowedTabs?.includes(tab.id);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleToggleTab(tab.id)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${
                        isAllowed 
                          ? 'bg-pink-50 border-pink-400 text-pink-900 font-bold shadow-2xs' 
                          : 'bg-slate-50/60 border-slate-200 text-slate-400 hover:bg-white'
                      }`}
                    >
                      <span className="text-xs">{tab.label}</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                        isAllowed ? 'bg-pink-600 text-white border-pink-600' : 'border-slate-300'
                      }`}>
                        {isAllowed ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section B: Detailed Edit Permissions */}
            <div className="space-y-4 pt-2 border-t border-pink-100">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Action & Data Edit Privileges
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Headcount Edit Privilege */}
                <div className="p-4 bg-pink-50/40 rounded-2xl border border-pink-200 space-y-2">
                  <span className="text-xs font-extrabold text-slate-800 block">Headcount & Staffing Edits</span>
                  <p className="text-[11px] text-slate-500">Specify whether this role can modify staff counts and roles.</p>

                  <select
                    value={
                      activeRolePerms.canEditHeadcount === true 
                        ? 'ALL' 
                        : activeRolePerms.canEditHeadcount === false 
                        ? 'NONE' 
                        : String(activeRolePerms.canEditHeadcount)
                    }
                    onChange={(e) => handleHeadcountEditChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-pink-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  >
                    <option value="NONE">Forbidden (Read-Only Headcount)</option>
                    <option value="ALL">Full Permission (All Departments)</option>
                    <option value="CUTTING">Cutting Dept Only ("CUTTING")</option>
                    <option value="PRODUCTION FLOOR">Production Dept Only ("PRODUCTION FLOOR")</option>
                    <option value="QC">QC Dept Only ("QC")</option>
                  </select>
                </div>

                {/* Wage Edit Toggle */}
                <div className="p-4 bg-pink-50/40 rounded-2xl border border-pink-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 block">Wage Rate Edits</span>
                    <p className="text-[11px] text-slate-500">Edit permanent/temporary daily pay rates.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!activeRolePerms.canEditWages}
                    onChange={(e) => handleTogglePerm('canEditWages', e.target.checked)}
                    className="w-5 h-5 accent-pink-600 rounded cursor-pointer"
                  />
                </div>

                {/* Style CM Earnings Edit Toggle */}
                <div className="p-4 bg-pink-50/40 rounded-2xl border border-pink-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 block">Style CM Prices & Quantities</span>
                    <p className="text-[11px] text-slate-500">Modify garment CM prices, SMVs, and outputs.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!activeRolePerms.canEditEarnings}
                    onChange={(e) => handleTogglePerm('canEditEarnings', e.target.checked)}
                    className="w-5 h-5 accent-pink-600 rounded cursor-pointer"
                  />
                </div>

                {/* SAH Efficiency Edit Toggle */}
                <div className="p-4 bg-pink-50/40 rounded-2xl border border-pink-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 block">SAH & Line Efficiency Log</span>
                    <p className="text-[11px] text-slate-500">Edit line SMVs, MOS, and SAH outputs.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!activeRolePerms.canEditSAH}
                    onChange={(e) => handleTogglePerm('canEditSAH', e.target.checked)}
                    className="w-5 h-5 accent-pink-600 rounded cursor-pointer"
                  />
                </div>

                {/* Overheads Edit Toggle */}
                <div className="p-4 bg-pink-50/40 rounded-2xl border border-pink-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 block">Overhead Expense Log</span>
                    <p className="text-[11px] text-slate-500">Edit monthly factory rent, water & electricity.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!activeRolePerms.canEditOverheads}
                    onChange={(e) => handleTogglePerm('canEditOverheads', e.target.checked)}
                    className="w-5 h-5 accent-pink-600 rounded cursor-pointer"
                  />
                </div>

                {/* Add/Delete Shift Dates Toggle */}
                <div className="p-4 bg-pink-50/40 rounded-2xl border border-pink-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 block">Create / Remove Shift Dates</span>
                    <p className="text-[11px] text-slate-500">Create new shift dates or delete log sheets.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!activeRolePerms.canAddDeleteDates}
                    onChange={(e) => handleTogglePerm('canAddDeleteDates', e.target.checked)}
                    className="w-5 h-5 accent-pink-600 rounded cursor-pointer"
                  />
                </div>

                {/* Admin Roles Permission Management Toggle */}
                <div className="p-4 bg-pink-50/40 rounded-2xl border border-pink-200 flex items-center justify-between col-span-1 sm:col-span-2">
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 block flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-pink-600" /> Grant Role Administration Access
                    </span>
                    <p className="text-[11px] text-slate-500">Allows users in this role to grant/revoke permissions, edit user profiles, and delete accounts.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!activeRolePerms.canManageRoles}
                    onChange={(e) => handleTogglePerm('canManageRoles', e.target.checked)}
                    className="w-5 h-5 accent-pink-600 rounded cursor-pointer"
                  />
                </div>

              </div>
            </div>

            {/* Save & Store Action Banner */}
            <div className="pt-4 border-t border-pink-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-white p-4 rounded-2xl border border-pink-200">
              <div>
                <span className="text-xs font-black text-slate-900 block flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-pink-600" /> Persistent Role Storage Matrix
                </span>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  All security roles and permission configurations are stored persistently in Cloud Firestore (<code className="font-mono text-pink-700 font-bold">permissions_matrix</code>) and browser LocalStorage.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveAllRoles}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4 text-white" /> Save & Store All Roles Matrix
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 2: USER ACCOUNTS MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="bento-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-pink-100 pb-4 gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-600" /> Active System Users ({usersList.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage factory login accounts, reset passwords, edit roles, or delete users.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSaveAllUsers}
                className="px-3.5 py-2 bg-pink-100 hover:bg-pink-200 text-pink-900 border border-pink-300 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Save & Sync User Accounts"
              >
                <Save className="w-3.5 h-3.5 text-pink-700" /> Save & Sync Accounts
              </button>
              <button
                type="button"
                onClick={() => setShowAddUserModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" /> Add User Account
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-pink-200 rounded-2xl">
            <table className="w-full min-w-[620px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-pink-50/70 border-b border-pink-200 text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="p-3">User & Name</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Password</th>
                  <th className="p-3">Assigned Role</th>
                  <th className="p-3">Dept Restriction</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100 bg-white">
                {usersList.map((u) => {
                  const isSelf = u.username === currentUser.username;
                  const showPass = !!showPasswordsMap[u.username];
                  return (
                    <tr key={u.username} className="hover:bg-pink-50/40 transition">
                      <td className="p-3 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="px-2 py-0.5 bg-pink-100 text-pink-800 rounded-full text-[10px] font-extrabold">
                              You
                            </span>
                          )}
                          {u.role === 'super_admin' && (
                            <span className="px-1.5 py-0.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                              ROOT
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-700">{u.username}</td>
                      <td className="p-3 font-mono text-slate-600">
                        <div className="flex items-center gap-2">
                          <span>{showPass ? (u.password || '••••••••') : '••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.username)}
                            className="text-slate-400 hover:text-pink-600 transition cursor-pointer"
                            title={showPass ? 'Hide Password' : 'Show Password'}
                          >
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={u.role}
                            onChange={(e) => handleUserRoleChange(u.username, e.target.value)}
                            className="px-2.5 py-1 bg-white border border-pink-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-pink-500"
                          >
                            {Object.keys(rolePermissionsMap).map((rk) => (
                              <option key={rk} value={rk}>
                                {rolePermissionsMap[rk]?.roleName || rk}
                              </option>
                            ))}
                          </select>
                          {u.role !== 'super_admin' && Object.keys(rolePermissionsMap).length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(u.role)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title={`Permanently delete role "${rolePermissionsMap[u.role]?.roleName || u.role}" from system`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-mono font-bold">
                          {u.deptAccess || 'ALL'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="p-1.5 text-pink-700 hover:bg-pink-100 rounded-lg transition cursor-pointer"
                            title="Edit User Profile"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.username)}
                            disabled={isSelf}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 cursor-pointer"
                            title="Delete User Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save & Store Action Banner for Users */}
          <div className="pt-4 border-t border-pink-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-white p-4 rounded-2xl border border-pink-200">
            <div>
              <span className="text-xs font-black text-slate-900 block flex items-center gap-1.5">
                <Database className="w-4 h-4 text-pink-600" /> Multi-Layer Persistence Engine
              </span>
              <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                All registered user accounts and encrypted credentials are automatically synchronized between Cloud Firestore (<code className="font-mono text-pink-700 font-bold">app_users</code>) and browser LocalStorage.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveAllUsers}
              className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition cursor-pointer shrink-0"
            >
              <Save className="w-4 h-4 text-white" /> Save & Sync User Accounts
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CLOUD SECURITY CONFIG */}
      {activeSubTab === 'security' && (
        <div className="bento-card p-6 space-y-6">
          <div className="border-b border-pink-100 pb-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-pink-600" /> Firestore Security Rules & Configuration
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Rules defined in firestore.rules prevent unauthorized mutations and secure user data.
            </p>
          </div>

          <div className="p-4 bg-slate-900 text-pink-300 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
            <pre>{`rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /sheets/{sheetId} {
      allow read, write: if true;
    }
    match /roles/{roleId} {
      allow read, write: if true;
    }
    match /appUsers/{userId} {
      allow read, write: if true;
    }
  }
}`}</pre>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 space-y-1">
            <strong className="block font-extrabold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Firebase Deployed Successfully
            </strong>
            <p>Security rules have been compiled and published to Firebase Project ID: <code className="font-mono font-bold">tactical-vector-zzp2g</code>.</p>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOM ROLE */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-pink-200 p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-pink-600" /> Create Custom Security Role
              </h3>
              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Auto-Stored to Cloud
              </span>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Role Title / Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quality Inspector Lead"
                  value={newRoleTitle}
                  onChange={(e) => setNewRoleTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-pink-50/40 border border-pink-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Role Key ID (Optional - Auto-generated if left blank)</label>
                <input
                  type="text"
                  placeholder="e.g. qi_lead"
                  value={newRoleIdKey}
                  onChange={(e) => setNewRoleIdKey(e.target.value)}
                  className="w-full px-3.5 py-2 bg-pink-50/40 border border-pink-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Copy Settings from Existing Role Template</label>
                <select
                  value={templateRoleId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-pink-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-pink-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Custom Permissions --</option>
                  {Object.keys(rolePermissionsMap).map(rk => (
                    <option key={rk} value={rk}>
                      {rolePermissionsMap[rk]?.roleName || rk} ({rk})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tab Access Multiselect */}
              <div className="space-y-1.5 pt-2 border-t border-pink-100">
                <label className="font-extrabold text-slate-800 block uppercase tracking-wider text-[10px]">
                  Accessible Navigation Tabs
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_TAB_KEYS.map(tab => {
                    const isChecked = newRoleTabs.includes(tab.id);
                    return (
                      <label
                        key={tab.id}
                        className={`p-2 rounded-xl border text-[11px] font-bold flex items-center justify-between cursor-pointer transition ${
                          isChecked ? 'bg-pink-50 border-pink-400 text-pink-900' : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleNewRoleTab(tab.id)}
                          className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Edit Privileges Checklist */}
              <div className="space-y-2 pt-2 border-t border-pink-100">
                <label className="font-extrabold text-slate-800 block uppercase tracking-wider text-[10px]">
                  Action & Edit Privileges
                </label>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-pink-50/40 border border-pink-200 rounded-xl">
                    <span className="font-bold text-slate-700">Headcount Edits</span>
                    <select
                      value={
                        newRoleCanEditHc === true 
                          ? 'ALL' 
                          : newRoleCanEditHc === false 
                          ? 'NONE' 
                          : String(newRoleCanEditHc)
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'ALL') setNewRoleCanEditHc(true);
                        else if (val === 'NONE') setNewRoleCanEditHc(false);
                        else setNewRoleCanEditHc(val);
                      }}
                      className="px-2 py-1 bg-white border border-pink-300 rounded-lg font-bold text-xs cursor-pointer"
                    >
                      <option value="NONE">Forbidden</option>
                      <option value="ALL">Full Permission</option>
                      <option value="CUTTING">Cutting Dept</option>
                      <option value="PRODUCTION FLOOR">Production Floor</option>
                      <option value="QC">QC Dept</option>
                    </select>
                  </div>

                  <label className="flex items-center justify-between p-2 bg-pink-50/40 border border-pink-200 rounded-xl cursor-pointer">
                    <span className="font-bold text-slate-700">Wage Rate Edits</span>
                    <input
                      type="checkbox"
                      checked={newRoleCanEditWages}
                      onChange={(e) => setNewRoleCanEditWages(e.target.checked)}
                      className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 bg-pink-50/40 border border-pink-200 rounded-xl cursor-pointer">
                    <span className="font-bold text-slate-700">Style CM Prices & Quantities</span>
                    <input
                      type="checkbox"
                      checked={newRoleCanEditEarnings}
                      onChange={(e) => setNewRoleCanEditEarnings(e.target.checked)}
                      className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 bg-pink-50/40 border border-pink-200 rounded-xl cursor-pointer">
                    <span className="font-bold text-slate-700">SAH & Line Efficiency Log</span>
                    <input
                      type="checkbox"
                      checked={newRoleCanEditSah}
                      onChange={(e) => setNewRoleCanEditSah(e.target.checked)}
                      className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 bg-pink-50/40 border border-pink-200 rounded-xl cursor-pointer">
                    <span className="font-bold text-slate-700">Overhead Expenses</span>
                    <input
                      type="checkbox"
                      checked={newRoleCanEditOverheads}
                      onChange={(e) => setNewRoleCanEditOverheads(e.target.checked)}
                      className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 bg-pink-50/40 border border-pink-200 rounded-xl cursor-pointer">
                    <span className="font-bold text-slate-700">Create / Remove Shift Dates</span>
                    <input
                      type="checkbox"
                      checked={newRoleCanAddDeleteDates}
                      onChange={(e) => setNewRoleCanAddDeleteDates(e.target.checked)}
                      className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 bg-pink-50/40 border border-pink-200 rounded-xl cursor-pointer">
                    <span className="font-bold text-slate-700">Role Administration Privileges</span>
                    <input
                      type="checkbox"
                      checked={newRoleCanManageRoles}
                      onChange={(e) => setNewRoleCanManageRoles(e.target.checked)}
                      className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-pink-100">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Save & Store Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD USER ACCOUNT */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-pink-200 p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Create New User Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amanda Dlamini"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-300 rounded-xl font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. amanda"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-300 rounded-xl font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assign Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-pink-300 rounded-xl font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                >
                  {Object.keys(rolePermissionsMap).map((rk) => (
                    <option key={rk} value={rk}>
                      {rolePermissionsMap[rk]?.roleName || rk}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Department Access Restriction (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. CUTTING (leave blank for ALL)"
                  value={newUserDept}
                  onChange={(e) => setNewUserDept(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-extrabold shadow-md cursor-pointer"
                >
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER ACCOUNT */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-pink-200 p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Edit User Profile</h3>
              <span className="text-[10px] font-mono font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-md">
                @{editingUser.username}
              </span>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-300 rounded-xl font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assign Security Role</label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-pink-300 rounded-xl font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                >
                  {Object.keys(rolePermissionsMap).map((rk) => (
                    <option key={rk} value={rk}>
                      {rolePermissionsMap[rk]?.roleName || rk}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Department Access Restriction</label>
                <input
                  type="text"
                  placeholder="e.g. CUTTING (leave blank for ALL)"
                  value={editUserDept}
                  onChange={(e) => setEditUserDept(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-extrabold shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Role Confirmation Modal */}
      {roleToDelete && (
        <ConfirmModal
          isOpen={!!roleToDelete}
          onClose={() => setRoleToDelete(null)}
          onConfirm={() => executeDeleteRole(roleToDelete.roleKey)}
          title={`Delete Role "${roleToDelete.roleName}"`}
          message={`Are you sure you want to PERMANENTLY DELETE role "${roleToDelete.roleName}"?`}
          subMessage={roleToDelete.assignedCount > 0 
            ? `${roleToDelete.assignedCount} user(s) currently assigned to this role will be reassigned to the default Super Administrator role.` 
            : 'This action will immediately purge the role from Cloud Firestore and local storage.'
          }
          confirmText="Yes, Delete Role"
          cancelText="Cancel"
          confirmVariant="danger"
          icon="trash"
        />
      )}

      {/* Delete User Account Confirmation Modal */}
      {userToDelete && (
        <ConfirmModal
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={() => executeDeleteUser(userToDelete)}
          title={`Delete User Account "@${userToDelete}"`}
          message={`Are you sure you want to delete user account "${userToDelete}"?`}
          subMessage="This will remove the user's login access to this system immediately."
          confirmText="Yes, Delete User"
          cancelText="Cancel"
          confirmVariant="danger"
          icon="trash"
        />
      )}

    </div>
  );
}

