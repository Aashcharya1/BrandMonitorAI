"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type DmarcPieChartProps = {
  data: { name: string; value: number, fill: string }[];
};

export function DmarcPieChart({ data }: DmarcPieChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              borderColor: "hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={100}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill} />
            ))}
          </Pie>
          <Legend iconSize={12} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
