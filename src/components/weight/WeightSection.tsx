import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Scale,
  Plus,
  History,
  Settings2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWeightData } from "@/hooks/useWeightData";
import { fromKg, toKg, formatWeight, type WeightUnit } from "@/lib/weightConversion";
import { WeightChart } from "./WeightChart";
import { WeightEntryForm } from "./WeightEntryForm";
import { WeightHistory } from "./WeightHistory";

interface WeightSectionProps {
  userId: string;
}

export function WeightSection({ userId }: WeightSectionProps) {
  const { toast } = useToast();
  const {
    entries,
    weightProfile,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    updateWeightSettings,
  } = useWeightData(userId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [settingsHeight, setSettingsHeight] = useState("");
  const [settingsTarget, setSettingsTarget] = useState("");
  const [settingsUnit, setSettingsUnit] = useState<WeightUnit>("kg");

  const handleOpenSettings = () => {
    setSettingsHeight(weightProfile.height?.toString() ?? "");
    setSettingsTarget(
      weightProfile.target_weight != null
        ? fromKg(weightProfile.target_weight, weightProfile.weight_unit).toFixed(1)
        : ""
    );
    setSettingsUnit(weightProfile.weight_unit);
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    try {
      const height = settingsHeight ? Number(settingsHeight) : null;
      const targetRaw = settingsTarget ? Number(settingsTarget) : null;

      if (height != null && (height < 50 || height > 300)) {
        toast({ title: "Error", description: "La altura debe estar entre 50 y 300 cm", variant: "destructive" });
        return;
      }

      // Target weight stored in kg
      let targetInKg: number | null = null;
      if (targetRaw != null) {
        targetInKg = Number(toKg(targetRaw, settingsUnit).toFixed(2));
      }

      await updateWeightSettings.mutateAsync({
        height,
        target_weight: targetInKg,
        weight_unit: settingsUnit,
      });

      setShowSettings(false);
      toast({ title: "Configuración guardada" });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar la configuración", variant: "destructive" });
    }
  };

  const handleAddEntry = async (data: { weight: number; entry_date: string; notes?: string }) => {
    try {
      await addEntry.mutateAsync(data);
      toast({ title: "Peso registrado" });
    } catch (err: any) {
      const isDuplicate = err?.code === "23505";
      toast({
        title: "Error",
        description: isDuplicate
          ? "Ya existe un registro para esa fecha. Editalo desde el historial."
          : "No se pudo registrar el peso",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleUpdateEntry = async (params: { id: string; weight: number; notes?: string | null }) => {
    try {
      await updateEntry.mutateAsync(params);
      toast({ title: "Registro actualizado" });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteEntry.mutateAsync(id);
      toast({ title: "Registro eliminado" });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const lastEntry = entries[0];
  const firstEntry = entries[entries.length - 1];
  const recentEntries = entries.slice(0, 30);

  if (loading) {
    return (
      <Card className="p-4 sm:p-6 bg-card border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-[200px] w-full mb-4" />
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4 sm:p-6 bg-card border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Scale className="h-5 w-5 text-accent" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground">
              Seguimiento de Peso
            </h3>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpenSettings}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick stats */}
        {entries.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-secondary/20">
              <p className="text-xs text-muted-foreground">Último registro</p>
              <p className="text-lg font-bold text-foreground">
                {formatWeight(fromKg(lastEntry!.weight, weightProfile.weight_unit), weightProfile.weight_unit)}
              </p>
            </div>
            {entries.length > 1 && (
              <div className="p-3 rounded-lg bg-secondary/20">
                <p className="text-xs text-muted-foreground">Cambio total</p>
                {(() => {
                  const diff = fromKg(lastEntry!.weight, weightProfile.weight_unit) -
                    fromKg(firstEntry!.weight, weightProfile.weight_unit);
                  return (
                    <p
                      className={`text-lg font-bold ${
                        diff < 0
                          ? "text-green-600 dark:text-green-400"
                          : diff > 0
                          ? "text-red-500"
                          : "text-foreground"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatWeight(diff, weightProfile.weight_unit)}
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        {recentEntries.length >= 2 ? (
          <div className="mb-4">
            <WeightChart
              entries={recentEntries}
              unit={weightProfile.weight_unit}
              targetWeight={weightProfile.target_weight}
              height={200}
            />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center mb-4">
            <Scale className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-1">
              Comienza a registrar tu peso
            </p>
            <p className="text-sm text-muted-foreground/70">
              Lleva un seguimiento de tu progreso
            </p>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex gap-2">
          <Button className="flex-1 gap-2" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />
            Registrar peso
          </Button>
          {entries.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={() => setShowHistory(true)}>
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Historial</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Dialogs */}
      <WeightEntryForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        unit={weightProfile.weight_unit}
        onSubmit={handleAddEntry}
        isPending={addEntry.isPending}
      />

      <WeightHistory
        open={showHistory}
        onOpenChange={setShowHistory}
        entries={entries}
        unit={weightProfile.weight_unit}
        onUpdate={handleUpdateEntry}
        onDelete={handleDeleteEntry}
        isUpdating={updateEntry.isPending}
        isDeleting={deleteEntry.isPending}
      />

      {/* Settings dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Configuración de peso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Unidad de peso</Label>
              <RadioGroup
                value={settingsUnit}
                onValueChange={(v) => setSettingsUnit(v as WeightUnit)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="kg" id="unit-kg" />
                  <Label htmlFor="unit-kg" className="font-normal cursor-pointer">Kilogramos (kg)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="lb" id="unit-lb" />
                  <Label htmlFor="unit-lb" className="font-normal cursor-pointer">Libras (lb)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-height">Altura (cm)</Label>
              <Input
                id="settings-height"
                type="number"
                step="0.1"
                placeholder="Ej: 170"
                value={settingsHeight}
                onChange={(e) => setSettingsHeight(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-target">Peso objetivo ({settingsUnit})</Label>
              <Input
                id="settings-target"
                type="number"
                step="0.1"
                placeholder={`Ej: ${settingsUnit === "kg" ? "70.0" : "154.0"}`}
                value={settingsTarget}
                onChange={(e) => setSettingsTarget(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveSettings}
                disabled={updateWeightSettings.isPending}
              >
                {updateWeightSettings.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
