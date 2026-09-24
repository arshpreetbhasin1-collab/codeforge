"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Code2,
  GitBranch,
  FolderKanban,
  MessagesSquare,
  LineChart,
  RotateCcw,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Code2 },
  { href: "/skill-graph", label: "Skill Graph", icon: GitBranch },
  { href: "/review", label: "Review Queue", icon: RotateCcw },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/interviews", label: "Interviews", icon: MessagesSquare },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r px-3 py-4">
      <Link href="/home" className="mb-4 px-2 font-mono text-sm font-semibold tracking-tight">
        CodeForge
      </Link>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
