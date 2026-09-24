import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Profile — CodeForge" };

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-muted-foreground">Your CodeForge account.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {profile.displayName ?? profile.username}
            <Badge variant="secondary" className="capitalize">
              {profile.role}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <Row label="Username" value={`@${profile.username}`} />
          <Row label="Timezone" value={profile.timezone} />
          <Row label="Member since" value={new Date(profile.createdAt).toLocaleDateString()} />
        </CardContent>
      </Card>

      <form action={logout}>
        <Button type="submit" variant="outline">
          Log out
        </Button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
