
export enum UserRole {
  ADMIN = 'ADMIN',
  GERANT = 'GERANT',
  SERVEUR = 'SERVEUR',
  CAISSIER = 'CAISSIER',
  CUISINE = 'CUISINE',
  BLOCKED = 'BLOCKED',
  DELETED = 'DELETED'
}

export enum TableStatus {
  LIBRE = 'LIBRE',
  OCCUPEE = 'OCCUPEE',
  ATTENTE_PAIEMENT = 'ATTENTE_PAIEMENT'
}

export enum OrderStatus {
  EN_COURS = 'EN_COURS',
  PRET = 'PRET',
  SERVI = 'SERVI',
  PAYE = 'PAYE'
}

export enum PaymentMode {
  CASH_USD = 'CASH_USD',
  CASH_CDF = 'CASH_CDF',
  M_PESA = 'M_PESA',
  AIRTEL_MONEY = 'AIRTEL_MONEY',
  ORANGE_MONEY = 'ORANGE_MONEY'
}

export enum StockMovementType {
  ENTREE = 'ENTREE',
  VENTE = 'VENTE',
  PERTE = 'PERTE'
}

export interface User {
  id: string;
  nom: string;
  identifiant: string;
  telephone: string;
  role: UserRole;
  email: string;
  restaurantId: string;
}

export interface Table {
  id: string;
  numero: number;
  statut: TableStatus;
  restaurantId: string;
}

export interface Product {
  id: string;
  nom: string;
  categorie: 'Bière' | 'Sucré' | 'Forte' | 'Cuisine';
  prixUSD: number;
  stockActuel: number;
  seuilAlerte: number;
  besoinVidange: boolean; // Si le produit nécessite une bouteille consignée
  restaurantId: string;
}

export interface OrderItem {
  productId: string;
  quantite: number;
  prixUnitaireUSD: number;
}

export interface Order {
  id: string;
  tableId: string;
  serveurId: string;
  items: OrderItem[];
  statut: OrderStatus;
  modePaiement?: PaymentMode;
  transactionId?: string;
  createdAt: number;
  readyAt?: number;
  paidAt?: number;
  cashierId?: string;
  kitchenId?: string;
  vidangesDues: number; // Nombre de bouteilles vides non encore rendues
  restaurantId: string;
}

export interface Expense {
  id: string;
  description: string;
  montantUSD: number;
  categorie: 'Personnel' | 'Achat Stock' | 'Maintenance' | 'Loyer/Charges' | 'Autre';
  date: number;
  createdBy: string;
  restaurantId: string;
}

export interface SubscriptionInfo {
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';
  endsAt: number;
}

export interface Settings {
  tauxUSD_CDF: number;
  taxeDGRK: number; // Pourcentage
  nomEtablissement?: string;
  logoUrl?: string;
  idNat?: string;
  rccm?: string;
  nif?: string;
  adresse?: string;
  telephone?: string;
  ownerEmail?: string;
  stockManagementEnabled?: boolean;
  subscription?: SubscriptionInfo;
}

export interface StaffActivity {
  id: string;
  uid: string;
  restaurantId: string;
  action: 'LOGIN' | 'LOGOUT' | 'ORDER_SUBMIT';
  timestamp: number;
  deviceInfo?: string;
}
