import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@material-ui/core/styles";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { startOfHour, parseISO, format } from "date-fns";

import useTickets from "../../hooks/useTickets";

const HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
];

const Chart = () => {
  const theme = useTheme();
  const c = theme.custom;
  const date = useRef(new Date().toISOString());
  const { tickets } = useTickets({ date: date.current });

  const [chartData, setChartData] = useState(HOURS.map((time) => ({ time, amount: 0 })));

  useEffect(() => {
    const counts = HOURS.map((time) => ({ time, amount: 0 }));
    tickets.forEach((ticket) => {
      const hour = format(startOfHour(parseISO(ticket.createdAt)), "HH:mm");
      const slot = counts.find((a) => a.time === hour);
      if (slot) slot.amount++;
    });
    setChartData(counts);
  }, [tickets]);

  const primary = theme.palette.primary.main;

  return (
    <ResponsiveContainer>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="ticketsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity={0.28} />
            <stop offset="100%" stopColor={primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.border} />
        <XAxis
          dataKey="time"
          tickLine={false}
          axisLine={false}
          tick={{ fill: c.textSubtle, fontSize: 12 }}
          dy={6}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: c.textSubtle, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ stroke: c.borderStrong, strokeDasharray: "4 4" }}
          contentStyle={{
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            boxShadow: c.shadowLg,
            fontSize: 12,
          }}
          labelStyle={{ color: c.textMuted, fontWeight: 600 }}
          formatter={(v) => [v, "Tickets"]}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke={primary}
          strokeWidth={2.5}
          fill="url(#ticketsFill)"
          activeDot={{ r: 5, strokeWidth: 2, stroke: c.surface }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default Chart;
