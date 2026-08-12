import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { Archive, BarChart3, LogOut, PanelLeft, Plus, Sparkles } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: Plus, label: "New campaign", path: "/" },
  { icon: BarChart3, label: "Performance", path: "/analytics" },
  { icon: Archive, label: "Campaign library", path: "/history" },
];
const SIDEBAR_WIDTH_KEY = "pulseforge-sidebar-width";
const DEFAULT_WIDTH = 266;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();
  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0c16] px-5 text-white pulse-grid">
        <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-white/[0.04] p-10 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-300 to-violet-400 text-[#171222]"><Sparkles className="h-6 w-6" /></div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-rose-200">PulseForge AI</p>
          <h1 className="font-display text-4xl leading-tight">Creative intelligence, made personal.</h1>
          <p className="mt-4 text-sm leading-6 text-white/60">Sign in to generate, store, and revisit your campaign production packs.</p>
          <Button onClick={() => startLogin()} className="mt-8 h-12 w-full rounded-xl bg-white text-[#15121f] hover:bg-rose-50">Sign in with Manus</Button>
        </div>
      </div>
    );
  }
  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, sidebarWidth, setSidebarWidth }: { children: React.ReactNode; sidebarWidth: number; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      setSidebarWidth(Math.max(220, Math.min(360, event.clientX - left)));
    };
    const stop = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", stop);
    }
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", stop); };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div ref={sidebarRef} className="relative">
        <Sidebar collapsible="icon" className="border-r border-white/[0.07] bg-[#12111c] text-white">
          <SidebarHeader className="h-[92px] justify-center px-4">
            <div className="flex items-center gap-3">
              <button onClick={toggleSidebar} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10" aria-label="Toggle navigation"><PanelLeft className="h-4 w-4" /></button>
              {!isCollapsed && <div className="min-w-0"><p className="font-display text-xl leading-none tracking-tight">PulseForge</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200/75">Ad Studio</p></div>}
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 pt-3">
            {!isCollapsed && <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Workspace</p>}
            <SidebarMenu>
              {menuItems.map(item => <SidebarMenuItem key={item.path}>
                <SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl text-white/62 hover:bg-white/[0.07] hover:text-white data-[active=true]:bg-gradient-to-r data-[active=true]:from-rose-300/20 data-[active=true]:to-violet-300/15 data-[active=true]:text-white">
                  <item.icon className="h-4 w-4" /><span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-xl p-1 text-left hover:bg-white/[0.06]">
                    <Avatar className="h-8 w-8 border border-white/10"><AvatarFallback className="bg-rose-200 text-xs font-bold text-[#251e34]">{user?.name?.charAt(0).toUpperCase() || "P"}</AvatarFallback></Avatar>
                    {!isCollapsed && <div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{user?.name || "PulseForge creator"}</p><p className="mt-0.5 truncate text-[10px] text-white/40">Creative workspace</p></div>}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarFooter>
        </Sidebar>
        {!isCollapsed && <div className="absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize hover:bg-rose-300/50" onMouseDown={() => setIsResizing(true)} aria-label={`Resize navigation, currently ${sidebarWidth}px`} />}
      </div>
      <SidebarInset className="min-h-screen bg-[#0d0c16]">{children}</SidebarInset>
    </>
  );
}
