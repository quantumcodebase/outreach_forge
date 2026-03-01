import './globals.css';
import type { ReactNode } from 'react';
import { AppShell } from '../components/layout/app-shell';
import { ToastProvider } from '../components/ui/toast';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
