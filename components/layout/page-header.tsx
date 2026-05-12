type Props = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: Props) {
  return (
    <header className="flex flex-col gap-1">
      {subtitle ? (
        <span className="text-sm text-fg-muted">{subtitle}</span>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight text-fg-primary">
        {title}
      </h1>
    </header>
  );
}
