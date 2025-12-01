"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type DmarcPieChartProps = {
  data: { name: string; value: number, fill: string }[];
};

export function DmarcPieChart({ data }: DmarcPieChartProps) {
  // If we only have one data point, create a complementary slice to show the full circle
  const chartData = data.length === 1 
    ? [
        ...data,
        { name: "Other", value: 100 - data[0].value, fill: "hsl(var(--muted))" }
      ]
    : data;

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
            formatter={(value: number) => [`${value}%`, "Percentage"]}
          />
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}%`}
            outerRadius={100}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill} />
            ))}
          </Pie>
          <Legend iconSize={12} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
