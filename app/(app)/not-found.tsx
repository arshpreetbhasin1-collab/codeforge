import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Not found</h1>
      <p className="text-muted-foreground">This lesson or problem doesn&apos;t exist, or isn&apos;t published yet.</p>
      <div className="mt-2 flex gap-2">
        <Button asChild variant="outline">
          <Link href="/learn">Back to Learn</Link>
        </Button>
        <Button asChild>
          <Link href="/practice">Back to Practice</Link>
        </Button>
      </div>
    </div>
  );
}
