export function ComingSoon({
  title,
  description,
  prompt,
}: {
  title: string;
  description: string;
  prompt: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-lg text-muted-foreground">{description}</p>
      <p className="mt-4 text-xs font-medium text-muted-foreground">Ships in {prompt}.</p>
    </div>
  );
}
