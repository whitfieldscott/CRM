import Link from "next/link";

export default function MetrcIndexPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Metrc</h1>
      <p className="text-muted-foreground">
        Choose a facility license from the sidebar to open its dashboard, or open a license you
        have bookmarked.
      </p>
      <p className="text-sm text-muted-foreground">
        Licenses are loaded from the API when the app shell loads; if the list is empty, check{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">METRC_USER_KEY</code> in{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code>.
      </p>
      <p className="text-sm">
        <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
