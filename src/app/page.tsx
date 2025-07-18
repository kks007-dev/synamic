import { Dashboard } from '@/components/dashboard';

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <div className="relative min-h-screen w-full bg-gradient-to-br from-background via-background to-accent/10">
        <Dashboard />
      </div>
    </main>
  );
}
