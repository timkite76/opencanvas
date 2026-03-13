export interface DeckTheme {
  backgroundColor: string;
  titleFont: string;
  bodyFont: string;
  titleColor: string;
  bodyColor: string;
  accentPalette: string[];
}

export const DEFAULT_DECK_THEME: DeckTheme = {
  backgroundColor: '#ffffff',
  titleFont: 'system-ui, sans-serif',
  bodyFont: 'system-ui, sans-serif',
  titleColor: '#1a1a2e',
  bodyColor: '#333333',
  accentPalette: ['#1a73e8', '#e67e22', '#34a853', '#ea4335', '#9b59b6'],
};
