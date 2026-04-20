import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SidebarNav } from '@/components/sidebar-nav';
import { Ticker } from '@/components/ticker';
import { PublishButton } from '@/components/publish-button';
import { TooltipProvider } from '@/components/ui/tooltip';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sports Oracle',
  description: 'MLB hitter, pitcher, and NRFI projections',
};

const PRE_HYDRATION_THEME = `
(function(){
  try {
    var mode = localStorage.getItem('oracle-theme');
    if (mode !== 'light') { mode = 'dark'; }
    if (mode === 'dark') { document.documentElement.classList.add('dark'); }
    else { document.documentElement.classList.remove('dark'); }
  } catch (_) { document.documentElement.classList.add('dark'); }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const showPublish = process.env.DATA_MODE !== 'static';
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_THEME }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider>
          <div className="flex min-h-screen">
            <SidebarNav />
            <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
              <Ticker />
              <div className="flex-1">{children}</div>
            </main>
          </div>
          {showPublish && <PublishButton />}
        </TooltipProvider>
      </body>
    </html>
  );
}
