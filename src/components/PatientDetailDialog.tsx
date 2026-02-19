import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Clock,
  Download,
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

      // Check if patient has no messages
      if (data?.no_messages) {
        setError('no_messages');
        return;
      }

      // Check if data contains an error
      if (data?.error) {
        setError(data.error);
        return;
      }

      if (fnError) {
        throw fnError;
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

  const exportToPDF = () => {
    if (!summary) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Resumen de ${patientName || "Paciente"}`, margin, yPos);
    yPos += 10;

    // Metadata
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const dateStr = summary.generated_at
      ? new Date(summary.generated_at).toLocaleString("es-AR", {
          dateStyle: "long",
          timeStyle: "short",
        })
      : "";
    doc.text(`Generado: ${dateStr} | ${summary.messages_analyzed} mensajes analizados`, margin, yPos);
    yPos += 15;

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Helper function to add section
    const addSection = (title: string, content: string | string[]) => {
      if (!content || (Array.isArray(content) && content.length === 0)) return;

      // Check if we need a new page
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin, yPos);
      yPos += 7;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      if (Array.isArray(content)) {
        content.forEach((item) => {
          const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
          if (yPos + lines.length * 5 > 280) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(lines, margin, yPos);
          yPos += lines.length * 5 + 2;
        });
      } else {
        const lines = doc.splitTextToSize(content, maxWidth);
        if (yPos + lines.length * 5 > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(lines, margin, yPos);
        yPos += lines.length * 5;
      }

      yPos += 10;
    };

    // Add sections
    addSection("Resumen General", summary.resumen_general);
    addSection("Temas Principales", summary.temas_principales);
    addSection("Preocupaciones Clave", summary.preocupaciones_clave);
    addSection("Patrones Detectados", summary.patrones_detectados);
    addSection("Recomendaciones para el Médico", summary.recomendaciones_medicas);

    // Save the PDF
    const fileName = `resumen-${(patientName || "paciente").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);

    toast({
      title: "PDF exportado",
      description: "El resumen se ha descargado correctamente",
    });
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
          error === "no_messages" ? (
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
            {/* Metadata with refresh button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  {summary.messages_analyzed} mensajes analizados
                </Badge>
                {summary.generated_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(summary.generated_at).toLocaleString("es-AR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={generateSummary}
                      disabled={loading}
                      className="h-8 px-2 text-xs"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Regenerar resumen con los mensajes más recientes</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={exportToPDF}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Exportar PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Descargar resumen como archivo PDF</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
