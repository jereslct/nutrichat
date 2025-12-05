import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  ListChecks,
  TrendingUp,
  FileText,
} from "lucide-react";

interface PatientSummary {
  resumen_general: string;
  temas_principales: string[];
  preocupaciones_clave: string[];
  patrones_detectados: string;
  recomendaciones_medicas: string;
  messages_analyzed: number;
  generated_at: string;
}

interface PatientDetailDialogProps {
  patientId: string;
  patientName: string | null;
}

export const PatientDetailDialog = ({
  patientId,
  patientName,
}: PatientDetailDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-patient-summary",
        {
          body: { patient_id: patientId },
        }
      );

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      setSummary(data.summary);
    } catch (err) {
      console.error("Error generating summary:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Error al generar el resumen";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !summary) {
      generateSummary();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Ver detalle
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Resumen de {patientName || "Paciente"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Analizando conversaciones...
                </p>
              </div>
            </div>
          </div>
        ) : error ? (
          error.includes("No hay mensajes") ? (
            <div className="py-8 text-center space-y-4">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <div className="space-y-2">
                <p className="font-medium text-foreground">Sin conversaciones</p>
                <p className="text-sm text-muted-foreground">
                  Este paciente aún no ha realizado consultas en el chat.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={generateSummary} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            </div>
          )
        ) : summary ? (
          <div className="space-y-4 py-2">
            {/* Metadata */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">
                {summary.messages_analyzed} mensajes analizados
              </Badge>
              {summary.generated_at && (
                <span>
                  Generado:{" "}
                  {new Date(summary.generated_at).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </div>

            {/* Resumen General */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Resumen General
                </h4>
                <p className="text-sm text-muted-foreground">
                  {summary.resumen_general}
                </p>
              </CardContent>
            </Card>

            {/* Temas Principales */}
            {summary.temas_principales?.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-accent" />
                    Temas Principales
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.temas_principales.map((tema, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tema}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preocupaciones Clave */}
            {summary.preocupaciones_clave?.length > 0 && (
              <Card className="bg-destructive/5 border-destructive/20">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Preocupaciones Clave
                  </h4>
                  <ul className="space-y-2">
                    {summary.preocupaciones_clave.map((preocupacion, i) => (
                      <li
                        key={i}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="text-destructive">•</span>
                        {preocupacion}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Patrones Detectados */}
            {summary.patrones_detectados && (
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Patrones Detectados
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {summary.patrones_detectados}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Recomendaciones */}
            {summary.recomendaciones_medicas && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-success" />
                    Recomendaciones para el Médico
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {summary.recomendaciones_medicas}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Regenerar */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={generateSummary}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerar resumen
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
