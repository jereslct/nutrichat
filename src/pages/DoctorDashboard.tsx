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
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Leaf,
  Search,
  Users,
  MessageSquare,
  Clock,
  LogOut,
  User,
  Loader2,
  CreditCard,
  UserCheck,
  BarChart3,
} from "lucide-react";
import { LinkRequestsNotification } from "@/components/LinkRequestsNotification";
import { AllPatientsDialog } from "@/components/AllPatientsDialog";
import { PatientDetailDialog } from "@/components/PatientDetailDialog";
import { PatientsListDialog } from "@/components/PatientsListDialog";
import { PendingRequestsDialog } from "@/components/PendingRequestsDialog";
import { DashboardAnalytics } from "@/components/DashboardAnalytics";
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
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    if (!roleLoading && !user) {
      navigate("/register");
    } else if (!roleLoading && role !== "doctor") {
      navigate("/upload");
    }
  }, [roleLoading, user, role, navigate]);

  useEffect(() => {
    if (user && role === "doctor") {
      fetchPatients();
      fetchPendingRequestsCount();
    }
  }, [user, role, pagination.page]);

  const fetchPendingRequestsCount = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-pending-requests");
      if (error) throw error;
      setPendingRequestsCount(data?.total_incoming || 0);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    }
  };

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
    navigate("/register");
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
  const pendingFollowUp = pendingRequestsCount;

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="container mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Leaf className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <span className="font-bold text-lg sm:text-xl text-neutral-900">
              NutriChat
            </span>
            <Badge className="bg-primary/10 text-primary border-0 text-xs sm:text-sm">
              Médico
            </Badge>
          </div>

          <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <Input
                placeholder="Buscar paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-neutral-50 border-neutral-300 text-neutral-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LinkRequestsNotification onUpdate={() => { fetchPatients(); fetchPendingRequestsCount(); }} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-neutral-700 hover:bg-neutral-100">
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
                <DropdownMenuItem onClick={() => navigate("/subscription?tab=profesionales")}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Suscripción
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-heading-2 text-neutral-900">Panel de control</h1>
            <p className="text-body text-neutral-600 mt-1">
              Gestiona tus pacientes y monitorea su progreso
            </p>
          </div>
          <AllPatientsDialog onUpdate={fetchPatients} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <PatientsListDialog patients={patients}>
            <Card className="bg-white border-neutral-200 cursor-pointer hover:border-primary hover:shadow-md transition-all interactive">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-3xl font-bold text-neutral-900">{patients.length}</p>
                  <p className="text-sm text-neutral-600">Pacientes activos</p>
                </div>
              </CardContent>
            </Card>
          </PatientsListDialog>
          
          <Card 
            className="bg-white border-neutral-200 cursor-pointer hover:border-primary hover:shadow-md transition-all interactive"
            onClick={() => navigate("/subscription?tab=profesionales")}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <UserCheck className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold text-neutral-900">
                    {patients.length}/{profile?.licenses_count || 0}
                  </p>
                  <p className="text-sm text-neutral-600">Licencias usadas</p>
                </div>
              </div>
              <Progress 
                value={profile?.licenses_count ? (patients.length / profile.licenses_count) * 100 : 0} 
                className="h-2"
              />
              {profile?.plan_tier && (
                <p className="text-xs text-neutral-500 mt-2">
                  {profile.plan_tier === 'doctor_basic' ? 'Plan Médico Básico' : 
                   profile.plan_tier === 'doctor_pro' ? 'Plan Médico Plus' : 
                   profile.plan_tier === 'individual' ? 'Plan Personal' : 'Sin plan'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-neutral-200">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <MessageSquare className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-3xl font-bold text-neutral-900">{totalMessages}</p>
                <p className="text-sm text-neutral-600">Consultas totales</p>
              </div>
            </CardContent>
          </Card>
          <PendingRequestsDialog onUpdate={() => { fetchPatients(); fetchPendingRequestsCount(); }}>
            <Card className="bg-white border-neutral-200 cursor-pointer hover:border-primary hover:shadow-md transition-all interactive">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <Clock className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-3xl font-bold text-neutral-900">{pendingFollowUp}</p>
                  <p className="text-sm text-neutral-600">Requieren seguimiento</p>
                </div>
              </CardContent>
            </Card>
          </PendingRequestsDialog>
        </div>

        <Tabs defaultValue="patients" className="w-full">
          <TabsList className="bg-neutral-100 w-full sm:w-auto">
            <TabsTrigger value="patients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Pacientes
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analíticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="patients" className="mt-6">
            <div className="md:hidden mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <Input
                  placeholder="Buscar paciente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-neutral-50 border-neutral-300"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-heading-3 text-neutral-900 mb-4">Tus pacientes</h2>

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="bg-white border-neutral-200 animate-pulse">
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
                  <Card className="bg-neutral-50 border-neutral-200">
                    <CardContent className="p-8 sm:p-12 text-center">
                      <Users className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                      <h3 className="text-heading-3 text-neutral-900 mb-2">No hay pacientes</h3>
                      <p className="text-body text-neutral-600 mb-6">
                        {searchTerm
                          ? "No se encontraron pacientes con ese nombre"
                          : "Invita a tu primer paciente para comenzar"}
                      </p>
                      {!searchTerm && (
                        <AllPatientsDialog onUpdate={fetchPatients} />
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
                          className="bg-white border-neutral-200 hover:border-primary hover:shadow-md transition-all cursor-pointer interactive"
                        >
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <Avatar className="h-12 w-12 flex-shrink-0">
                                <AvatarImage src={patient.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                  {getInitials(patient.full_name)}
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-neutral-900 truncate">
                                    {patient.full_name || "Sin nombre"}
                                  </h3>
                                  <div
                                    className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                                      status === "active"
                                        ? "bg-green-500"
                                        : status === "moderate"
                                        ? "bg-yellow-500"
                                        : "bg-neutral-400"
                                    }`}
                                    title={
                                      status === "active"
                                        ? "Activo"
                                        : status === "moderate"
                                        ? "Moderado"
                                        : "Inactivo"
                                    }
                                  />
                                </div>
                                <div className="flex items-center gap-4 text-xs sm:text-sm text-neutral-600 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className={`h-3 w-3 ${patient.total_messages > 0 ? 'text-primary' : 'text-neutral-400'}`} />
                                    {patient.total_messages > 0 ? `${patient.total_messages} chats` : "Sin chats"}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatLastActivity(patient.last_activity)}
                                  </span>
                                </div>
                                {patient.has_diet && (
                                  <Badge className="mt-2 text-xs bg-primary/10 text-primary border-0">
                                    Plan cargado
                                  </Badge>
                                )}
                              </div>

                              <PatientDetailDialog
                                patientId={patient.id}
                                patientName={patient.full_name}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {pagination.total_pages > 1 && (
                  <div className="flex justify-center pt-4">
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
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <DashboardAnalytics />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DoctorDashboard;
