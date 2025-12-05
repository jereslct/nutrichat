import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PendingRequest {
  id: string;
  requester_id: string;
  requester_role: string;
  created_at: string;
  other_user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
  };
}

interface PendingRequestsDialogProps {
  children: React.ReactNode;
  onUpdate?: () => void;
}

const getInitials = (name: string | null) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatDate = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `hace ${days} días`;
};

export const PendingRequestsDialog = ({ children, onUpdate }: PendingRequestsDialogProps) => {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchRequests();
    }
  }, [open]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-pending-requests");
      if (error) throw error;
      setRequests(data?.incoming || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: "accept" | "reject") => {
    setProcessingId(requestId);
    try {
      const actionMap = {
        accept: "accept_request",
        reject: "reject_request",
      };
      const { error } = await supabase.functions.invoke("handle-link-request", {
        body: { request_id: requestId, action: actionMap[action] },
      });
      if (error) throw error;
      
      toast({
        title: action === "accept" ? "Solicitud aceptada" : "Solicitud rechazada",
        description: action === "accept" 
          ? "El paciente ha sido vinculado exitosamente"
          : "La solicitud ha sido rechazada",
      });
      
      fetchRequests();
      onUpdate?.();
    } catch (error) {
      console.error("Error handling request:", error);
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-destructive" />
            Solicitudes Pendientes ({requests.length})
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tienes solicitudes pendientes
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.other_user?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(request.other_user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm block truncate">
                      {request.other_user?.full_name || "Sin nombre"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(request.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRequest(request.id, "reject")}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-success hover:text-success hover:bg-success/10"
                      onClick={() => handleRequest(request.id, "accept")}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
