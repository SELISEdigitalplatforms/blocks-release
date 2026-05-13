export interface User {
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  language: string;
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  userName: string;
  phoneNumber: string;
  roles: string[];
  permissions: string[];
  active: boolean;
  isVarified: boolean;
  profileImageUrl: string;
  mfaEnabled: boolean;
  lastLoggedInTime: string;
  logInCount: number;
  firstLoggedInTime: string;
  userMfaType: number;
  isMfaVerified: boolean;
  userCreationType: number;
  memberships: IMembership[];
}

export interface IMembership {
  organizationId: string;
  roles: string[];
  permissions: string[];
}
