import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Asif bhai ekhon kothay? — Made by Mir',
  description: 'Canteen e ghumay, na desk e kaj kore? A very serious office mystery. Made by Mir.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
