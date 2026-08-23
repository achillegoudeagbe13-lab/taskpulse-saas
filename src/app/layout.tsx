import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskPulse | Le travail, en mouvement',
  description: 'Plateforme de suivi du travail pour les équipes modernes.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
