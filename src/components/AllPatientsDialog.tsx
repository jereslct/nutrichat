import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Search, Check, Clock, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Patient {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_linked: boolean;
  pending_request: {
    id: string;
    status: string;
    requester_role: string;
    is_incoming: boolean;
  } | null;
}

interface AllPatientsDialogProps {
  onUpdate?: () => void;
}

export const AllPatientsDialog = ({ onUpdate }: AllPatientsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-all-patients");
      if (error) throw error;
      setPatients(data.patients || []);
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

  useEffect(() => {
    if (open) {
      fetchPatients();
    }
  }, [open]);

  const handleSendRequest = async (patientId: string) => {
    setProcessingId(patientId);
    try {
      const { data, error } = await supabase.functions.invoke("handle-link-request", {
        body: { action: "send_request", target_id: patientId },
      });

      if (error) throw error;

      toast({
        title: "¡Solicitud enviada!",
        description: "El paciente recibirá tu solicitud de vinculación",
      });

      fetchPatients();
      onUpdate?.();
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
      const { data, error } = await supabase.functions.invoke("handle-link-request", {
        body: { action: "accept_request", request_id: requestId },
      });

      if (error) throw error;

      toast({
        title: "¡Vinculación exitosa!",
        description: "El paciente ha sido vinculado",
      });

      fetchPatients();
      onUpdate?.();
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

  const filteredPatients = patients.filter((patient) =>
    patient.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <UserPlus className="mr-2 h-4 w-4" />
          Invitar Paciente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Todos los Pacientes
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No se encontraron pacientes" : "No hay pacientes en el sistema"}
            </div>
          ) : (
            filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  patient.is_linked
                    ? "bg-primary/5 border border-primary/20"
                    : "bg-secondary/20 hover:bg-secondary/30"
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={patient.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(patient.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">
                    {patient.full_name || "Sin nombre"}
                  </p>
                  {patient.is_linked && (
                    <span className="text-xs text-success">Vinculado</span>
                  )}
                </div>

                {patient.is_linked ? (
                  <Check className="h-5 w-5 text-success" />
                ) : patient.pending_request ? (
                  patient.pending_request.is_incoming ? (
                    <Button
                      size="sm"
                      onClick={() => handleAcceptRequest(patient.pending_request!.id)}
                      disabled={processingId === patient.pending_request.id}
                    >
                      {processingId === patient.pending_request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Aceptar"
                      )}
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      Pendiente
                    </Badge>
                  )
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendRequest(patient.id)}
                    disabled={processingId === patient.id}
                  >
                    {processingId === patient.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Invitar"
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
