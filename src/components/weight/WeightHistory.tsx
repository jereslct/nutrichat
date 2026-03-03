import { useState } from "react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Scale } from "lucide-react";
import { fromKg, formatWeight, type WeightUnit } from "@/lib/weightConversion";
import type { WeightEntry } from "@/hooks/useWeightData";
import { WeightEntryForm } from "./WeightEntryForm";

interface WeightHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: WeightEntry[];
  unit: WeightUnit;
  onUpdate: (params: { id: string; weight: number; notes?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
}

function formatEntryDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, "d MMM yyyy", { locale: es });
}

export function WeightHistory({
  open,
  onOpenChange,
  entries,
  unit,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: WeightHistoryProps) {
  const [editEntry, setEditEntry] = useState<WeightEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleUpdate = async (data: { weight: number; entry_date: string; notes?: string }) => {
    if (!editEntry) return;
    await onUpdate({ id: editEntry.id, weight: data.weight, notes: data.notes ?? null });
    setEditEntry(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await onDelete(deleteId);
    setDeleteId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Historial de peso</DialogTitle>
          </DialogHeader>

          {entries.length === 0 ? (
            <div className="py-12 text-center">
              <Scale className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Aún no tienes registros de peso
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-2">
              {entries.map((entry, idx) => {
                const prev = entries[idx + 1];
                const diff =
                  prev != null
                    ? fromKg(entry.weight, unit) - fromKg(prev.weight, unit)
                    : null;

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-semibold text-foreground">
                          {formatWeight(fromKg(entry.weight, unit), unit)}
                        </span>
                        {diff != null && (
                          <span
                            className={`text-xs font-medium ${
                              diff < 0
                                ? "text-green-600 dark:text-green-400"
                                : diff > 0
                                ? "text-red-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff.toFixed(1)} {unit}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatEntryDate(entry.entry_date)}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                          {entry.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditEntry(entry)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <WeightEntryForm
        open={!!editEntry}
        onOpenChange={(o) => !o && setEditEntry(null)}
        unit={unit}
        entry={editEntry}
        onSubmit={handleUpdate}
        isPending={isUpdating}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente este
              registro de peso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
