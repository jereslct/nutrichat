import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale } from "lucide-react";
import { usePatientWeightData } from "@/hooks/useWeightData";
import { fromKg, formatWeight } from "@/lib/weightConversion";
import { WeightChart } from "./WeightChart";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface PatientWeightCardProps {
  patientId: string;
}

export function PatientWeightCard({ patientId }: PatientWeightCardProps) {
  const { entries, weightProfile, loading } = usePatientWeightData(patientId);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-[160px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Scale className="h-4 w-4 text-accent" />
            Seguimiento de Peso
          </h4>
          <p className="text-sm text-muted-foreground">
            Este paciente aún no tiene registros de peso.
          </p>
        </CardContent>
      </Card>
    );
  }

  const lastEntry = entries[0];
  const unit = weightProfile.weight_unit;
  const lastDate = format(parseISO(lastEntry.entry_date), "d 'de' MMMM yyyy", { locale: es });
  const recentEntries = entries.slice(0, 30);

  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Scale className="h-4 w-4 text-accent" />
          Seguimiento de Peso
        </h4>

        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-xl font-bold text-foreground">
            {formatWeight(fromKg(lastEntry.weight, unit), unit)}
          </span>
          <span className="text-xs text-muted-foreground">
            Último registro: {lastDate}
          </span>
        </div>

        {recentEntries.length >= 2 && (
          <WeightChart
            entries={recentEntries}
            unit={unit}
            targetWeight={weightProfile.target_weight}
            height={160}
          />
        )}

        <p className="text-xs text-muted-foreground mt-2">
          {entries.length} registro{entries.length !== 1 ? "s" : ""} en total
        </p>
      </CardContent>
    </Card>
  );
}
