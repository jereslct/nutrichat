import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  FileText,
  Loader2,
  BarChart3,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DailyMessage {
  date: string;
  count: number;
}

interface PatientStat {
  id: string;
  full_name: string;
  total_messages: number;
  messages_30d: number;
  last_activity: string | null;
  has_diet: boolean;
  assigned_at: string | null;
}

interface AnalyticsSummary {
  total_patients: number;
  active_patients: number;
  moderate_patients: number;
  inactive_patients: number;
  total_messages_30d: number;
  patients_with_diet: number;
  avg_messages_per_patient: number;
}

interface AnalyticsData {
  daily_messages: DailyMessage[];
  weekly_comparison: { current: number; previous: number };
  patient_stats: PatientStat[];
  summary: AnalyticsSummary;
}

const activityChartConfig = {
  count: {
    label: "Consultas",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const distributionChartConfig = {
  active: {
    label: "Activos",
    color: "#22c55e",
  },
  moderate: {
    label: "Moderados",
    color: "#f59e0b",
  },
  inactive: {
    label: "Inactivos",
    color: "#9ca3af",
  },
} satisfies ChartConfig;

const patientsChartConfig = {
  total_messages: {
    label: "Consultas totales",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${parseInt(day)}/${parseInt(month)}`;
}

function getWeeklyTrend(current: number, previous: number) {
  if (previous === 0 && current === 0) return { percentage: 0, direction: "neutral" as const };
  if (previous === 0) return { percentage: 100, direction: "up" as const };
  const change = ((current - previous) / previous) * 100;
  return {
    percentage: Math.abs(Math.round(change)),
    direction: change > 0 ? "up" as const : change < 0 ? "down" as const : "neutral" as const,
  };
}

export const DashboardAnalytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("get-doctor-analytics");
      if (error) throw error;
      setData(result);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las analíticas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white border-neutral-200">
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white border-neutral-200">
            <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
          <Card className="bg-white border-neutral-200">
            <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="bg-neutral-50 border-neutral-200">
        <CardContent className="p-12 text-center">
          <BarChart3 className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">Sin datos disponibles</h3>
          <p className="text-neutral-600">
            Las analíticas se generarán cuando tengas pacientes vinculados con actividad.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { daily_messages, weekly_comparison, patient_stats, summary } = data;
  const trend = getWeeklyTrend(weekly_comparison.current, weekly_comparison.previous);
  const topPatients = patient_stats.slice(0, 8);
  const dietAdoptionPercent = summary.total_patients > 0
    ? Math.round((summary.patients_with_diet / summary.total_patients) * 100)
    : 0;

  const distributionData = [
    { name: "active", value: summary.active_patients, fill: "#22c55e" },
    { name: "moderate", value: summary.moderate_patients, fill: "#f59e0b" },
    { name: "inactive", value: summary.inactive_patients, fill: "#9ca3af" },
  ].filter((d) => d.value > 0);

  const hasNoActivity = summary.total_patients === 0;

  return (
    <div className="space-y-6">
      {/* Summary metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-neutral-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Consultas (7 días)</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">{weekly_comparison.current}</p>
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${
                trend.direction === "up" ? "text-green-600" :
                trend.direction === "down" ? "text-red-500" : "text-neutral-500"
              }`}>
                {trend.direction === "up" && <TrendingUp className="h-4 w-4" />}
                {trend.direction === "down" && <TrendingDown className="h-4 w-4" />}
                {trend.direction === "neutral" && <Minus className="h-4 w-4" />}
                <span>{trend.percentage}%</span>
              </div>
            </div>
            <p className="text-xs text-neutral-400 mt-2">vs. semana anterior</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-neutral-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Promedio por paciente</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">
                  {summary.avg_messages_per_patient}
                </p>
              </div>
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <p className="text-xs text-neutral-400 mt-2">consultas últimos 30 días</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-neutral-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Adherencia al plan</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">{dietAdoptionPercent}%</p>
              </div>
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              {summary.patients_with_diet} de {summary.total_patients} con plan cargado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1: Activity over time + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area chart - messages over 30 days */}
        <Card className="bg-white border-neutral-200 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-neutral-900">
              Actividad de consultas
            </CardTitle>
            <CardDescription>
              Consultas de pacientes en los últimos 30 días
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.total_messages_30d === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-neutral-400">
                <div className="text-center">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin actividad en los últimos 30 días</p>
                </div>
              </div>
            ) : (
              <ChartContainer config={activityChartConfig} className="h-[220px] w-full">
                <AreaChart data={daily_messages} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(0, Math.floor(daily_messages.length / 7) - 1)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => {
                          const d = new Date(value + "T12:00:00");
                          return d.toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "long",
                          });
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut chart - activity distribution */}
        <Card className="bg-white border-neutral-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-neutral-900">
              Estado de pacientes
            </CardTitle>
            <CardDescription>
              Distribución por nivel de actividad
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasNoActivity ? (
              <div className="flex items-center justify-center h-[220px] text-neutral-400">
                <div className="text-center">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin pacientes</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <ChartContainer config={distributionChartConfig} className="h-[160px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span className="text-xs text-neutral-600">
                      Activos ({summary.active_patients})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs text-neutral-600">
                      Moderados ({summary.moderate_patients})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-neutral-400" />
                    <span className="text-xs text-neutral-600">
                      Inactivos ({summary.inactive_patients})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Top patients */}
      {topPatients.length > 0 && (
        <Card className="bg-white border-neutral-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-neutral-900">
              Pacientes más activos
            </CardTitle>
            <CardDescription>
              Ranking por cantidad total de consultas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topPatients.every((p) => p.total_messages === 0) ? (
              <div className="flex items-center justify-center h-[200px] text-neutral-400">
                <div className="text-center">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Tus pacientes aún no han realizado consultas</p>
                </div>
              </div>
            ) : (
              <ChartContainer
                config={patientsChartConfig}
                className="w-full"
                style={{ height: `${Math.max(180, topPatients.filter(p => p.total_messages > 0).length * 44)}px` }}
              >
                <BarChart
                  data={topPatients.filter((p) => p.total_messages > 0)}
                  layout="vertical"
                  margin={{ top: 0, right: 30, bottom: 0, left: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="full_name"
                    tick={{ fontSize: 12, fill: "#525252" }}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                    tickFormatter={(value: string) =>
                      value.length > 18 ? value.slice(0, 18) + "…" : value
                    }
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ fill: "hsl(var(--primary) / 0.05)" }}
                  />
                  <Bar
                    dataKey="total_messages"
                    fill="hsl(var(--primary))"
                    radius={[0, 6, 6, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
