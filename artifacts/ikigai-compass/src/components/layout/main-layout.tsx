import React from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import {
  Compass,
  LayoutDashboard,
  Map,
  Target,
  MessageSquare,
  CheckSquare,
  ShieldAlert,
  BookOpen,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/hypotheses", label: "Hypotheses", icon: Map },
  { href: "/plan", label: "Growth Plan", icon: Target },
  { href: "/coach", label: "Coach", icon: MessageSquare },
  { href: "/checkin", label: "Check-in", icon: CheckSquare },
  { href: "/obstacles", label: "Obstacles", icon: ShieldAlert },
  { href: "/reflections", label: "Reflections", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const NavLinks = () => (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href}>
            <span
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card/50 px-4 py-6">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-serif font-bold text-foreground">Ikigai</span>
        </div>
        <div className="flex-1">
          <NavLinks />
        </div>
        <div className="mt-auto border-t pt-4">
          <div className="flex items-center justify-between px-2 mb-4">
            <div className="flex items-center gap-3 truncate">
              <div className="h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 text-secondary-foreground font-medium">
                {user?.firstName?.charAt(0) || "U"}
              </div>
              <span className="text-sm font-medium truncate">{user?.fullName || user?.emailAddresses[0]?.emailAddress}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <Compass className="h-6 w-6 text-primary" />
          <span className="text-lg font-serif font-bold">Ikigai</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-6">
            <div className="flex items-center gap-2 mb-8">
              <Compass className="h-6 w-6 text-primary" />
              <span className="text-xl font-serif font-bold">Ikigai</span>
            </div>
            <NavLinks />
            <div className="absolute bottom-6 left-6 right-6">
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={() => signOut()}
              >
                <LogOut className="h-5 w-5 mr-3" />
                Sign out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:pt-0 pt-16 h-[100dvh] overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
