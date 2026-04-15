import { FinanceApp } from "@/components/FinanceApp";

/** Avoid stale HTML at hosts that cache static pages aggressively. */
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto min-w-0 max-w-6xl overflow-x-clip px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <FinanceApp />
    </main>
  );
}
