export interface MemberDto {
  userId: string;
  name: string;
  role: 'Owner' | 'Client';
  joinedAt: string;
}

export interface InviteCodeDto {
  code: string;
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
  isExpired: boolean;
}
