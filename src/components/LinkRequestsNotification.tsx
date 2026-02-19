import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LinkRequest {
  id: string;
  requester_id: string;
  target_id: string;
  requester_role: string;
  created_at: string;
  is_incoming: boolean;
  other_user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
}

interface LinkRequestsNotificationProps {
  onUpdate?: () => void;
}

export const LinkRequestsNotification = ({ onUpdate }: LinkRequestsNotificationProps) => {
  const [requests, setRequests] = useState<{
    incoming: LinkRequest[];
    outgoing: LinkRequest[];
  }>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-pending-requests");
      if (error) throw error;
      setRequests({
        incoming: data.incoming || [],
        outgoing: data.outgoing || [],
      });
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (action: string, requestId: string) => {
    setProcessingId(requestId);
    try {
      const { data, error } = await supabase.functions.invoke("handle-link-request", {
        body: { action, request_id: requestId },
      });

      if (error) throw error;

      toast({
        title: "¡Éxito!",
        description: data.message,
      });

      fetchRequests();
      onUpdate?.();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const totalIncoming = requests.incoming.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalIncoming > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs">
              {totalIncoming}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold">Solicitudes de vinculación</h4>
        </div>

        {loading ? (
          <div className="p-4 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.incoming.length === 0 && requests.outgoing.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No hay solicitudes pendientes
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {requests.incoming.length > 0 && (
              <div className="p-2">
                <p className="text-xs text-muted-foreground px-2 mb-2">Recibidas</p>
                {requests.incoming.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={req.other_user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(req.other_user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {req.other_user.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {req.other_user.role === "doctor" ? "Médico" : "Paciente"} quiere vincularse
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                        onClick={() => handleAction("accept_request", req.id)}
                        disabled={processingId === req.id}
                      >
                        {processingId === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleAction("reject_request", req.id)}
                        disabled={processingId === req.id}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {requests.outgoing.length > 0 && (
              <div className="p-2 border-t border-border">
                <p className="text-xs text-muted-foreground px-2 mb-2">Enviadas</p>
                {requests.outgoing.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={req.other_user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(req.other_user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {req.other_user.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Esperando respuesta...
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => handleAction("cancel_request", req.id)}
                      disabled={processingId === req.id}
                    >
                      Cancelar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
