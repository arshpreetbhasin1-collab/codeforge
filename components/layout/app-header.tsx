import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/types/domain";

export function AppHeader({ profile }: { profile: Profile }) {
  const initials = (profile.displayName ?? profile.username).slice(0, 2).toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            {profile.displayName ?? profile.username}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href="/profile">Profile</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <form action={logout} className="w-full">
              <button type="submit" className="w-full text-left">
                Log out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
