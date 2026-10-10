import { createFileRoute, Link } from "@tanstack/react-router";
import { Home as HomeIcon, Library as LibraryIcon, User } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Teacha — Profile" },
      { name: "description", content: "Your Teacha tester profile." },
      { property: "og:title", content: "Teacha — Profile" },
      { property: "og:description", content: "Your Teacha tester profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto w-full max-w-lg px-4 pt-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your profile details will appear here soon.</p>
      </div>
      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-background">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          <Link to="/home" className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground transition-colors hover:text-foreground">
            <HomeIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link to="/library" className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground transition-colors hover:text-foreground">
            <LibraryIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Library</span>
          </Link>
          <Link to="/profile" className="flex flex-col items-center gap-1 px-4 py-1 text-primary">
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
