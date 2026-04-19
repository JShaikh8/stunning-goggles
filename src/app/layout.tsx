import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SidebarNav } from '@/components/sidebar-nav';
import { TooltipProvider } from '@/components/ui/tooltip';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sports Oracle',
  description: 'MLB hitter, pitcher, and NRFI projections',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full surface-0 text-zinc-100">
        <TooltipProvider>
          <div className="flex min-h-screen">
            <SidebarNav />
            <main className="flex-1 overflow-x-hidden">{children}</main>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
