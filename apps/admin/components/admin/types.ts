export type UserType = "Super Admin" | "Admin" | "Agent" | "Creator";
export type Department = "Influencer Management" | "Sports Management" | "Information Technology" | "Executive";

export interface User {
    uid: string;
    displayName: string;
    email: string;
    userType: UserType;
    title?: string;
    department?: Department;
    photoURL?: string;
    status: 'active' | 'suspended' | 'deactivated' | 'probation';
    commission?: string;
    split?: number;
    managerId?: string;
    managerName?: string;
    lastUpdated?: string;
}

export const DEPARTMENTS: Department[] = [
    "Influencer Management",
    "Sports Management",
    "Information Technology",
    "Executive"
];

export const ITEMS_PER_PAGE = 15;

export type UserUpdates = Partial<Omit<User, 'uid'>>;