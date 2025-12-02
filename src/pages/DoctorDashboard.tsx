import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Leaf,
  Search,
  UserPlus,
  Users,
  MessageSquare,
  Clock,
  ChevronRight,
  LogOut,
  User,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Patient {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  last_activity: string | null;
  total_messages: number;
  has_diet: boolean;
  assigned_at: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading: roleLoading, profile } = useUserRole();
  const { toast } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!roleLoading && !user) {
      navigate("/auth");
    } else if (!roleLoading && role !== "doctor") {
      navigate("/upload");
    }
  }, [roleLoading, user, role, navigate]);

  useEffect(() => {
    if (user && role === "doctor") {
      fetchPatients();
    }
  }, [user, role, pagination.page]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-doctor-patients", {
        body: {},
        headers: {},
      });

      if (error) throw error;

      setPatients(data.patients || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatLastActivity = (date: string | null) => {
    if (!date) return "Sin actividad";
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Ayer";
    return `hace ${days} días`;
  };

  const getActivityStatus = (date: string | null) => {
    if (!date) return "inactive";
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 3) return "active";
    if (days <= 7) return "moderate";
    return "inactive";
  };

  const filteredPatients = patients.filter((patient) =>
    patient.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const activePatients = patients.filter(
    (p) => getActivityStatus(p.last_activity) === "active"
  ).length;
  const totalMessages = patients.reduce((sum, p) => sum + p.total_messages, 0);
  const pendingFollowUp = patients.filter(
    (p) => getActivityStatus(p.last_activity) === "inactive"
  ).length;

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              FoodTalk
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium">
                  {profile?.full_name || "Doctor"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Dashboard Médico</h1>
              <Badge className="bg-primary/10 text-primary border-0">
                Doctor
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Gestiona tus pacientes y revisa su progreso
            </p>
          </div>
          <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
            <UserPlus className="mr-2 h-4 w-4" />
            Invitar Paciente
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{patients.length}</p>
                <p className="text-sm text-muted-foreground">Pacientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-full">
                <MessageSquare className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMessages}</p>
                <p className="text-sm text-muted-foreground">Consultas totales</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-destructive/10 rounded-full">
                <Clock className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingFollowUp}</p>
                <p className="text-sm text-muted-foreground">Pendiente seguimiento</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search for mobile */}
        <div className="md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Patients List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              📋 Tus Pacientes
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPatients.length === 0 ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No hay pacientes</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm
                    ? "No se encontraron pacientes con ese nombre"
                    : "Invita a tu primer paciente para comenzar"}
                </p>
                {!searchTerm && (
                  <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invitar Paciente
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredPatients.map((patient) => {
                const status = getActivityStatus(patient.last_activity);
                return (
                  <Card
                    key={patient.id}
                    className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors cursor-pointer"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={patient.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(patient.full_name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">
                              {patient.full_name || "Sin nombre"}
                            </h3>
                            <span
                              className={`h-2 w-2 rounded-full ${
                                status === "active"
                                  ? "bg-success"
                                  : status === "moderate"
                                  ? "bg-yellow-500"
                                  : "bg-destructive"
                              }`}
                            />
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {patient.total_messages} mensajes
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatLastActivity(patient.last_activity)}
                            </span>
                          </div>
                          {patient.has_diet && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              Plan cargado
                            </Badge>
                          )}
                        </div>

                        <Button variant="ghost" size="sm">
                          Ver detalle
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() =>
                      setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
                    }
                    className={pagination.page === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map(
                  (page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setPagination((p) => ({ ...p, page }))}
                        isActive={pagination.page === page}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        page: Math.min(pagination.total_pages, p.page + 1),
                      }))
                    }
                    className={
                      pagination.page === pagination.total_pages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </main>
    </div>
  );
};

export default DoctorDashboard;
