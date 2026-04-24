export type TenantRole = 'Owner' | 'Client';

export interface TenantDto {
  id: string;
  name: string;
  role: TenantRole;
  joinedAt: string;
  memberCount: number;
  ownerName: string | null;
}
