import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  Crown, 
  DollarSign, 
  TrendingUp, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Ban,
  Stethoscope,
  User,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface RevenueBreakdownItem {
  plan: string;
  count: number;
  unitPrice: number;
  subtotal: number;
}

interface KPIs {
  totalUsers: number;
  premiumUsers: number;
  doctors: number;
  patients: number;
  monthlyRevenue: number;
  revenueBreakdown: RevenueBreakdownItem[];
  recentUsers: number;
}

interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  db_role: string;
  is_premium: boolean;
  subscription_status: string;
  created_at: string;
  avatar_url: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  individual: "Personal",
  doctor_basic: "Médico Básico",
  doctor_pro: "Médico Plus",
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isSuperAdmin, loading: authLoading } = useSuperAdmin();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [authLoading, isSuperAdmin, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchDashboardData();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    let result = users;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((u) => u.db_role === roleFilter);
    }

    if (statusFilter !== "all") {
      if (statusFilter === "premium") {
        result = result.filter((u) => u.is_premium);
      } else {
        result = result.filter((u) => !u.is_premium);
      }
    }

    setFilteredUsers(result);
  }, [users, searchTerm, roleFilter, statusFilter]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("No session");
      }

      const response = await supabase.functions.invoke("admin-dashboard", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      setKpis(response.data.kpis);
      setUsers(response.data.users);
      setFilteredUsers(response.data.users);
    } catch (error: any) {
      console.error("Error fetching dashboard:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del dashboard.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = (userId: string) => {
    toast({
      title: "Ver detalles",
      description: `Mostrando detalles del usuario ${userId}`,
    });
  };

  const handleToggleUser = async (userId: string, currentStatus: boolean) => {
    try {
      const newPremium = !currentStatus;
      const { error } = await supabase
        .from("profiles")
        .update({ 
          is_premium: newPremium,
          subscription_status: newPremium ? "authorized" : "free",
          plan_tier: newPremium ? "patient_premium" : null,
        })
        .eq("id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId 
            ? { ...u, is_premium: newPremium, subscription_status: newPremium ? "authorized" : "free" } 
            : u
        )
      );

      toast({
        title: "Usuario actualizado",
        description: `Estado premium ${newPremium ? "activado" : "desactivado"}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-heading-3 text-foreground">Panel de Administración</h1>
              <p className="text-body-small text-muted-foreground">
                Gestión completa de NutriChat
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <Crown className="h-3 w-3 mr-1" />
            Super Admin
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Usuarios
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {kpis?.totalUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +{kpis?.recentUsers || 0} últimos 30 días
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Usuarios Premium
              </CardTitle>
              <Crown className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {kpis?.premiumUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis?.totalUsers ? ((kpis.premiumUsers / kpis.totalUsers) * 100).toFixed(1) : 0}% de conversión
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ingresos Mensuales
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(kpis?.monthlyRevenue || 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {kpis?.revenueBreakdown?.length ? (
                  kpis.revenueBreakdown.map((item) => (
                    <p key={item.plan}>
                      {item.count} × {formatCurrency(item.unitPrice)} ({PLAN_LABELS[item.plan] || item.plan})
                    </p>
                  ))
                ) : (
                  <p>Sin suscripciones activas</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Distribución
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  <span className="text-lg font-bold">{kpis?.doctors || 0}</span>
                </div>
                <span className="text-muted-foreground">/</span>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-bold">{kpis?.patients || 0}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Doctores / Pacientes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gestión de Usuarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="doctor">Doctores</SelectItem>
                  <SelectItem value="patient">Pacientes</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="free">Gratuitos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Users Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden md:table-cell">Registro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No se encontraron usuarios
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {user.full_name || "Sin nombre"}
                              </p>
                              <p className="text-xs text-muted-foreground sm:hidden truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.db_role === "doctor" ? "default" : "secondary"}
                            className={user.db_role === "doctor" ? "bg-primary" : ""}
                          >
                            {user.db_role === "doctor" ? (
                              <Stethoscope className="h-3 w-3 mr-1" />
                            ) : (
                              <User className="h-3 w-3 mr-1" />
                            )}
                            {user.db_role === "doctor" ? "Doctor" : "Paciente"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.is_premium ? "default" : "outline"}
                            className={user.is_premium ? "bg-success" : ""}
                          >
                            {user.is_premium ? (
                              <>
                                <Crown className="h-3 w-3 mr-1" />
                                Premium
                              </>
                            ) : (
                              "Gratuito"
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {format(new Date(user.created_at), "dd MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewUser(user.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalles
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleUser(user.id, user.is_premium)}
                              >
                                {user.is_premium ? (
                                  <>
                                    <Ban className="h-4 w-4 mr-2" />
                                    Quitar Premium
                                  </>
                                ) : (
                                  <>
                                    <Crown className="h-4 w-4 mr-2" />
                                    Dar Premium
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Mostrando {filteredUsers.length} de {users.length} usuarios
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminDashboard;
