"use client";

import { Dashboard } from '@/components/dashboard';
import { useAuth } from '@/components/auth-provider';

export default function Home() {
  const { user } = useAuth();
  
  if (!user) {
    // AuthProvider should handle redirection, but this is a fallback.
    return null;
  }
  
  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <div className="relative min-h-screen w-full bg-gradient-to-br from-background via-background to-accent/10">
        <Dashboard />
      </div>
    </main>
  );
}
