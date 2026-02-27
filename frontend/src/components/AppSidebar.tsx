import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  FileSearch,
  FilePlus,
  Map,
  MessageSquare,
  LogOut,
  Shield,
  User,
} from "lucide-react";

const citizenLinks = [
  {
    title: "Report Missing",
    url: "/citizen/report",
    icon: FilePlus,
  },
  {
    title: "My Requests",
    url: "/citizen/requests",
    icon: FileSearch,
  },
];

const policeLinks = [
  {
    title: "Dashboard",
    url: "/police/dashboard",
    icon: LayoutDashboard,
  },
];

const sharedLinks = [
  {
    title: "Case Map",
    url: "/case-map",
    icon: Map,
  },
  {
    title: "AI Chat",
    url: "/chat",
    icon: MessageSquare,
  },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const roleLinks = user?.role === "POLICE" ? policeLinks : citizenLinks;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-pointer"
              onClick={() => navigate("/")}
            >
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground">
                <Shield className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-bold text-base">REUNITE</span>
                <span className="text-xs text-muted-foreground">
                  Missing Persons Platform
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {user?.role === "POLICE" ? "Investigation" : "Citizen Portal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {roleLinks.map((link) => (
                <SidebarMenuItem key={link.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === link.url}
                    tooltip={link.title}
                  >
                    <a
                      href={link.url}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(link.url);
                      }}
                    >
                      <link.icon />
                      <span>{link.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sharedLinks.map((link) => (
                <SidebarMenuItem key={link.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === link.url}
                    tooltip={link.title}
                  >
                    <a
                      href={link.url}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(link.url);
                      }}
                    >
                      <link.icon />
                      <span>{link.title}</span>
                    </a>
                  </SidebarMenuButton>
                  {link.url === "/chat" && (
                    <SidebarMenuBadge className="bg-primary/10 text-primary text-[10px]">
                      AI
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 leading-none min-w-0">
                <span className="font-medium text-sm truncate">
                  {user?.name}
                </span>
                <Badge
                  variant="secondary"
                  className="w-fit text-[10px] px-1.5 py-0"
                >
                  {user?.role === "POLICE" ? (
                    <>
                      <Shield className="size-2.5 mr-0.5" /> Police
                    </>
                  ) : (
                    <>
                      <User className="size-2.5 mr-0.5" /> Citizen
                    </>
                  )}
                </Badge>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              tooltip="Logout"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
