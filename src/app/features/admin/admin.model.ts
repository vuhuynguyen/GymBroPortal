export interface AdminTenantDto {
  id: string;
  name: string;
  ownerUserId: string;
  ownerName: string;
  memberCount: number;
  createdOnUtc: string;
}

export interface AdminUserDto {
  id: string;
  name: string;
  createdOnUtc: string;
}
