import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Clock, Users } from "lucide-react";
import { PatientDetailDialog } from "./PatientDetailDialog";

interface Patient {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  last_activity: string | null;
  total_messages: number;
  has_diet: boolean;
  assigned_at: string;
}

interface PatientsListDialogProps {
  patients: Patient[];
  children: React.ReactNode;
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

export const PatientsListDialog = ({ patients, children }: PatientsListDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Lista de Pacientes ({patients.length})
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {patients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tienes pacientes asignados
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {patients.map((patient) => {
                const status = getActivityStatus(patient.last_activity);
                return (
                  <div
                    key={patient.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={patient.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(patient.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-sm">
                          {patient.full_name || "Sin nombre"}
                        </span>
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className={`flex items-center gap-1 whitespace-nowrap ${patient.total_messages === 0 ? 'text-muted-foreground/50' : ''}`}>
                          <MessageSquare className={`h-3 w-3 flex-shrink-0 ${patient.total_messages > 0 ? 'text-primary' : ''}`} />
                          <span>{patient.total_messages > 0 ? patient.total_messages : 'Sin'}</span>
                        </span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span>{formatLastActivity(patient.last_activity)}</span>
                        </span>
                      </div>
                      {patient.has_diet && (
                        <Badge variant="secondary" className="mt-1 text-xs py-0">
                          Plan cargado
                        </Badge>
                      )}
                    </div>
                    <PatientDetailDialog
                      patientId={patient.id}
                      patientName={patient.full_name}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
