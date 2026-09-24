import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Interviews — CodeForge" };

export default function InterviewsPage() {
  return (
    <ComingSoon
      title="Interviews"
      description="AI-driven interview simulation, debugging mode, and system-design challenges."
      prompt="Prompt 8"
    />
  );
}
