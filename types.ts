
export enum Role {
  USER = 'USER',
  OPERATOR = 'OPERATOR',
  ADMIN = 'ADMIN'
}

export enum OperatorStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED'
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  password?: string;
  role: Role;
  coins: number;
  profilePic?: string;
  operatorDetails?: {
    ktpPhoto?: string;
    selfiePhoto?: string;
    status: OperatorStatus;
    tpstLocation: string;
    phoneNumber?: string;
  };
}

export interface SembakoProduct {
  id: string;
  name: string;
  description: string;
  priceInCoins: number;
  stock: number;
  image: string;
}

export interface WasteTransaction {
  id: string;
  userId: string;
  userName: string;
  operatorId: string;
  weightKg: number;
  coinsEarned: number;
  timestamp: number;
  scalePhoto: string;
  verificationPhoto: string;
  location: string; // Added location field
}

export interface RedemptionTransaction {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  coinsSpent: number;
  timestamp: number;
  expiresAt: number; // 5 minute expiry
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  qrCode: string;
}

export interface Promotion {
  id: string;
  title: string;
  image: string;
  link?: string;
}

export interface AppSettings {
  coinConversionRate: number; // Coins per kg
}
