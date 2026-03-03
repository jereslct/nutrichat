import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { fromKg, type WeightUnit } from "@/lib/weightConversion";

interface WeightChartProps {
  entries: Tables<"weight_entries">[];
  unit: WeightUnit;
  targetWeight?: number | null;
  height?: number;
}

const chartConfig = {
  weight: {
    label: "Peso",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig;

export function WeightChart({ entries, unit, targetWeight, height = 200 }: WeightChartProps) {
  const chartData = useMemo(() => {
    return [...entries]
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .map((e) => ({
        date: e.entry_date,
        weight: Number(fromKg(e.weight, unit).toFixed(1)),
      }));
  }, [entries, unit]);

  const targetInUnit = targetWeight != null ? Number(fromKg(targetWeight, unit).toFixed(1)) : null;

  if (chartData.length === 0) return null;

  const weights = chartData.map((d) => d.weight);
  const minW = Math.min(...weights, ...(targetInUnit != null ? [targetInUnit] : []));
  const maxW = Math.max(...weights, ...(targetInUnit != null ? [targetInUnit] : []));
  const padding = Math.max((maxW - minW) * 0.15, 1);

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => {
            try {
              return format(parseISO(v), "d MMM", { locale: es });
            } catch {
              return v;
            }
          }}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
        />
        <YAxis
          domain={[Math.floor(minW - padding), Math.ceil(maxW + padding)]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                try {
                  return format(parseISO(value as string), "d 'de' MMMM", { locale: es });
                } catch {
                  return String(value);
                }
              }}
              formatter={(value) => [`${value} ${unit}`, "Peso"]}
            />
          }
        />
        {targetInUnit != null && (
          <ReferenceLine
            y={targetInUnit}
            stroke="hsl(var(--primary))"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: `Meta: ${targetInUnit} ${unit}`,
              position: "right",
              fill: "hsl(var(--primary))",
              fontSize: 11,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="weight"
          stroke="hsl(var(--accent))"
          strokeWidth={2}
          fill="url(#colorWeight)"
          animationDuration={500}
        />
      </AreaChart>
    </ChartContainer>
  );
}
