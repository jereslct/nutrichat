import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope, UserPlus, Check, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Doctor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialty: string;
  is_linked: boolean;
  pending_request: {
    id: string;
    status: string;
    requester_role: string;
    is_incoming: boolean;
  } | null;
}

export const DoctorSelector = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDoctors = async () => {
    try {
      // Verificar sesión antes de llamar a la función
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("get-all-doctors", {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (error) throw error;
      setDoctors(data.doctors || []);
      setCurrentDoctorId(data.current_doctor_id);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los médicos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleSendRequest = async (doctorId: string) => {
    setProcessingId(doctorId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No autenticado");

      const { data, error } = await supabase.functions.invoke("handle-link-request", {
        body: { action: "send_request", target_id: doctorId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast({
        title: "¡Solicitud enviada!",
        description: "El médico recibirá tu solicitud de vinculación",
      });

      fetchDoctors();
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar la solicitud",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No autenticado");

      const { data, error } = await supabase.functions.invoke("handle-link-request", {
        body: { action: "accept_request", request_id: requestId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast({
        title: "¡Vinculación exitosa!",
        description: "Ahora estás vinculado con el médico",
      });

      fetchDoctors();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "No se pudo aceptar la solicitud",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
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

  if (loading) {
    return (
      <Card className="p-4 sm:p-6 bg-card border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 bg-card border-border/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
          <Stethoscope className="h-5 w-5 text-accent" />
        </div>
        <h3 className="text-lg sm:text-xl font-semibold text-foreground">
          Mi Médico
        </h3>
      </div>

      {doctors.length === 0 ? (
        <div className="text-center py-6">
          <Stethoscope className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            No hay médicos disponibles en el sistema
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                doctor.is_linked
                  ? "bg-primary/5 border border-primary/20"
                  : "bg-secondary/20"
              }`}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={doctor.avatar_url || undefined} />
                <AvatarFallback className="bg-accent/10 text-accent">
                  {getInitials(doctor.full_name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {doctor.full_name || "Médico"}
                  </p>
                  {doctor.is_linked && (
                    <Badge className="bg-success/10 text-success border-0 text-xs">
                      Vinculado
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
              </div>

              {doctor.is_linked ? (
                <Check className="h-5 w-5 text-success" />
              ) : doctor.pending_request ? (
                doctor.pending_request.is_incoming ? (
                  <Button
                    size="sm"
                    onClick={() => handleAcceptRequest(doctor.pending_request!.id)}
                    disabled={processingId === doctor.pending_request.id}
                    className="gap-1"
                  >
                    {processingId === doctor.pending_request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Aceptar
                      </>
                    )}
                  </Button>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Pendiente
                  </Badge>
                )
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendRequest(doctor.id)}
                  disabled={processingId === doctor.id}
                  className="gap-1"
                >
                  {processingId === doctor.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Solicitar
                    </>
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
