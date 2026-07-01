'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

// Colores Semánticos del Design System de AsistApp
export const ATTENDANCE_COLORS = {
  presente: '#10B981',   // Esmeralda suave
  tarde: '#F59E0B',      // Ámbar cálido
  ausente: '#EF4444',    // Carmesí elegante
  justificado: '#6366F1', // Índigo profundo
};

// -------------------------------------------------------------
// 1. Gráfico de Tendencia Histórica (Área)
// -------------------------------------------------------------
interface TrendData {
  date: string;
  presente: number;
  tarde: number;
  ausente: number;
  justificado: number;
  total: number;
}

export function TrendAreaChart({ data }: { data: TrendData[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-72 w-full flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 animate-pulse">
        <div className="text-sm text-zinc-400">Preparando gráfico de tendencias...</div>
      </div>
    );
  }

  // Dar formato amigable a las fechas (ej: 2026-05-20 -> 20 May)
  const formattedData = data.map((item) => {
    try {
      const parts = item.date.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const day = dateObj.getDate();
        const month = dateObj.toLocaleDateString('es-ES', { month: 'short' });
        return {
          ...item,
          formattedDate: `${day} ${month}`,
        };
      }
    } catch (_) {}
    return { ...item, formattedDate: item.date };
  });

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPresente" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={ATTENDANCE_COLORS.presente} stopOpacity={0.2} />
              <stop offset="95%" stopColor={ATTENDANCE_COLORS.presente} stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorAusente" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={ATTENDANCE_COLORS.ausente} stopOpacity={0.1} />
              <stop offset="95%" stopColor={ATTENDANCE_COLORS.ausente} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" className="dark:stroke-zinc-800" />
          <XAxis
            dataKey="formattedDate"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#71717A', fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#71717A', fontSize: 11 }}
            domain={[0, 'dataMax + 2']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181B',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '12px',
            }}
            labelClassName="font-medium text-zinc-400 mb-1"
          />
          <Area
            type="monotone"
            dataKey="presente"
            name="Presentes"
            stroke={ATTENDANCE_COLORS.presente}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPresente)"
          />
          <Area
            type="monotone"
            dataKey="tarde"
            name="Tardes"
            stroke={ATTENDANCE_COLORS.tarde}
            strokeWidth={1.5}
            fill="none"
          />
          <Area
            type="monotone"
            dataKey="ausente"
            name="Ausencias"
            stroke={ATTENDANCE_COLORS.ausente}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorAusente)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// -------------------------------------------------------------
// 2. Gráfico de Distribución (Dona / Pie)
// -------------------------------------------------------------
interface PieData {
  name: string;
  value: number;
  color: string;
}

export function StatusPieChart({ data }: { data: { presente: number; tarde: number; ausente: number; justificado: number } }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-72 w-full flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 animate-pulse">
        <div className="text-sm text-zinc-400">Preparando gráfico de distribución...</div>
      </div>
    );
  }

  const pieData: PieData[] = [
    { name: 'Presente', value: data.presente, color: ATTENDANCE_COLORS.presente },
    { name: 'Tarde', value: data.tarde, color: ATTENDANCE_COLORS.tarde },
    { name: 'Ausente', value: data.ausente, color: ATTENDANCE_COLORS.ausente },
    { name: 'Justificado', value: data.justificado, color: ATTENDANCE_COLORS.justificado },
  ].filter((item) => item.value > 0);

  // Si no hay datos registrados
  if (pieData.length === 0) {
    return (
      <div className="h-72 w-full flex flex-col items-center justify-center text-center">
        <span className="text-sm text-zinc-400 dark:text-zinc-500">No hay registros de asistencia en este período</span>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181B',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// -------------------------------------------------------------
// 3. Gráfico de Rendimiento por Asignatura (Barras)
// -------------------------------------------------------------
interface BarData {
  name: string;
  code: string;
  presentes: number;
  tardes: number;
  ausentes: number;
  justificados: number;
  attendanceRate: number;
}

export function SubjectsBarChart({ data }: { data: BarData[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-72 w-full flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 animate-pulse">
        <div className="text-sm text-zinc-400">Preparando desglose académico...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" className="dark:stroke-zinc-800" />
          <XAxis
            dataKey="code"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#71717A', fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#71717A', fontSize: 11 }}
            domain={[0, 100]}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181B',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '12px',
            }}
            formatter={(value: any, name: any) => [
              name === 'attendanceRate' ? `${value}%` : value,
              name === 'attendanceRate' ? 'Tasa de Asistencia' : name
            ]}
          />
          <Bar
            dataKey="attendanceRate"
            name="Asistencia"
            radius={[4, 4, 0, 0]}
            maxBarSize={45}
          >
            {data.map((entry, index) => {
              // Si la asistencia está en riesgo (<80%), pintar carmesí, de lo contrario esmeralda
              const color = entry.attendanceRate < 80 ? ATTENDANCE_COLORS.ausente : ATTENDANCE_COLORS.presente;
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
