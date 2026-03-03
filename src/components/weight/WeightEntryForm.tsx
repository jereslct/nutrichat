import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { fromKg, toKg, type WeightUnit } from "@/lib/weightConversion";
import type { Tables } from "@/integrations/supabase/types";

const entrySchema = z.object({
  weight: z.coerce
    .number({ invalid_type_error: "Ingresa un número válido" })
    .positive("El peso debe ser mayor a 0")
    .max(700, "Valor demasiado alto"),
  entry_date: z.string().min(1, "Selecciona una fecha"),
  notes: z.string().max(500).optional(),
});

type EntryFormValues = z.infer<typeof entrySchema>;

interface WeightEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: WeightUnit;
  entry?: Tables<"weight_entries"> | null;
  onSubmit: (data: { weight: number; entry_date: string; notes?: string }) => Promise<void>;
  isPending: boolean;
}

export function WeightEntryForm({
  open,
  onOpenChange,
  unit,
  entry,
  onSubmit,
  isPending,
}: WeightEntryFormProps) {
  const isEditing = !!entry;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      weight: undefined,
      entry_date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (entry) {
        reset({
          weight: Number(fromKg(entry.weight, unit).toFixed(1)),
          entry_date: entry.entry_date,
          notes: entry.notes ?? "",
        });
      } else {
        reset({
          weight: undefined,
          entry_date: format(new Date(), "yyyy-MM-dd"),
          notes: "",
        });
      }
    }
  }, [open, entry, unit, reset]);

  const handleFormSubmit = async (data: EntryFormValues) => {
    const weightInKg = toKg(data.weight, unit);
    await onSubmit({
      weight: Number(weightInKg.toFixed(2)),
      entry_date: data.entry_date,
      notes: data.notes || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar registro" : "Registrar peso"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weight">Peso ({unit})</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder={`Ej: ${unit === "kg" ? "75.0" : "165.0"}`}
              {...register("weight")}
              autoFocus
            />
            {errors.weight && (
              <p className="text-sm text-destructive">{errors.weight.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry_date">Fecha</Label>
            <Input
              id="entry_date"
              type="date"
              max={format(new Date(), "yyyy-MM-dd")}
              {...register("entry_date")}
            />
            {errors.entry_date && (
              <p className="text-sm text-destructive">{errors.entry_date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ej: Después de entrenar..."
              rows={2}
              {...register("notes")}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : isEditing ? (
                "Guardar cambios"
              ) : (
                "Registrar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
