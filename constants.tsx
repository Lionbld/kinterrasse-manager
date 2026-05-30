
import { Product, Table, TableStatus } from './types';

export const INITIAL_TABLES: Omit<Table, 'restaurantId'>[] = Array.from({ length: 20 }, (_, i) => ({
  id: `table-${i + 1}`,
  numero: i + 1,
  statut: TableStatus.LIBRE,
}));

export const INITIAL_PRODUCTS: Omit<Product, 'restaurantId'>[] = [
  { id: '1', nom: 'Primus 72cl', categorie: 'Bière', prixUSD: 2.5, stockActuel: 48, seuilAlerte: 12, besoinVidange: true },
  { id: '2', nom: 'Tembo 33cl', categorie: 'Bière', prixUSD: 1.8, stockActuel: 24, seuilAlerte: 10, besoinVidange: true },
  { id: '3', nom: 'Coca-Cola 30cl', categorie: 'Sucré', prixUSD: 1.0, stockActuel: 60, seuilAlerte: 15, besoinVidange: true },
  { id: '4', nom: 'Eau Vive 1.5L', categorie: 'Sucré', prixUSD: 1.2, stockActuel: 30, seuilAlerte: 5, besoinVidange: false },
  { id: '5', nom: 'Poulet Mayo', categorie: 'Cuisine', prixUSD: 15, stockActuel: 10, seuilAlerte: 2, besoinVidange: false },
  { id: '6', nom: 'Frites', categorie: 'Cuisine', prixUSD: 5, stockActuel: 20, seuilAlerte: 5, besoinVidange: false },
  { id: '7', nom: 'Johnny Walker Black', categorie: 'Forte', prixUSD: 85, stockActuel: 5, seuilAlerte: 1, besoinVidange: false },
];
