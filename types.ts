
export interface ProductAnalysis {
  productName: string;
  detectedText: string | null;
  brand: string | null;
  searchKeywords: string[];
  exactSearchQuery: string;
  shortDescription: string;
  category: string;
  subCategory: string; // Added field for Sub-Category
  goldenTitle: string; 
  marketingTags: string[]; 
  attributes: Record<string, string>;
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax]
  
  // Flattened accessors for ordering logic
  color?: string;
  material?: string;
  style?: string;
  shape?: string;
  visualFeature?: string;
}

export interface AnalyzedItem {
  id: string;
  previewUrl: string;
  base64: string;
  status: 'pending' | 'analyzing' | 'success' | 'error';
  result: ProductAnalysis | null;
  error?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED'
}
