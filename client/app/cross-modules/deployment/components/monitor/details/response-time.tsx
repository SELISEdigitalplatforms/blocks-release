import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

type DowntimeLog = {
  startTime: string;
  endTime: string | null;
  downtimeDurationSeconds: number | null;
};

type ResponseTimeProps = {
  interval: number;
  timeout: number;
  data: DowntimeLog[] | null | undefined;
  timeRange: string;
  setTimeRange: (value: string) => void;
  currentStatus: boolean;
  request: boolean;
};

type ChartPoint = {
  ts: number;
  status: number;
  // optional meta for tooltip
  startTime?: number;
  endTime?: number;
  duration?: number;
};

const TIME_RANGES: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

const formatDuration = (ms: number) => {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const d = Math.floor(hr / 24);

  if (d > 0) return `${d}d ${hr % 24}h`;
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
};

const ResponseTime = ({
  data: downtimes,
  timeRange,
  setTimeRange,
  interval,
  timeout,
  currentStatus,
  request,
}: ResponseTimeProps) => {
  const now = Date.now();
  const rangeStart = now - (TIME_RANGES[timeRange] ?? TIME_RANGES["1h"]);

  // metrics
  const metrics = useMemo(() => {
    let totalDowntime = 0;
    let downtimeCount = 0;

    if (!downtimes || !Array.isArray(downtimes) || downtimes.length === 0) {
      return {
        uptimePercentage: "100.00",
        totalDowntime: "0s",
        downtimeCount: 0,
      };
    }

    for (const log of downtimes) {
      const s = new Date(log.startTime).getTime();
      const e = log.endTime ? new Date(log.endTime).getTime() : now;

      if (e < rangeStart || s > now) continue;

      const cs = Math.max(s, rangeStart);
      const ce = Math.min(e, now);

      totalDowntime += Math.max(0, ce - cs);
      downtimeCount++;
    }

    const totalTime = Math.max(1, now - rangeStart);
    const uptimePct = ((totalTime - totalDowntime) / totalTime) * 100;

    return {
      uptimePercentage: uptimePct.toFixed(2),
      totalDowntime: formatDuration(totalDowntime),
      downtimeCount,
    };
  }, [downtimes, rangeStart, now]);

  // build chart data (strict linear timeline, stepAfter semantics via step-like points)
  const chartData: ChartPoint[] = useMemo(() => {
    const pts: ChartPoint[] = [];

    // start edge: assume UP at rangeStart (will be corrected by downtimes if overlap)
    pts.push({ ts: rangeStart, status: 1 });

    if (!downtimes || !Array.isArray(downtimes) || downtimes.length === 0) {
      pts.push({ ts: now, status: currentStatus ? 1 : 0 });
      return pts.sort((a, b) => a.ts - b.ts);
    }

    // normalize and clip downtimes to range
    const relevant = downtimes
      .map((d) => ({
        start: new Date(d.startTime).getTime(),
        end: d.endTime ? new Date(d.endTime).getTime() : now,
      }))
      .filter((d) => d.end >= rangeStart && d.start <= now)
      .sort((a, b) => a.start - b.start);

    for (const d of relevant) {
      const s = Math.max(d.start, rangeStart);
      const e = Math.min(d.end, now);

      // push one tick immediately before downtime to keep step visual (if within range)
      if (s - 1 >= rangeStart) pts.push({ ts: s - 1, status: 1 });

      // downtime start
      pts.push({
        ts: s,
        status: 0,
        startTime: s,
        endTime: e,
        duration: Math.round((e - s) / 1000),
      });

      // downtime end
      pts.push({
        ts: e,
        status: 0,
        startTime: s,
        endTime: e,
        duration: Math.round((e - s) / 1000),
      });

      // push one tick immediately after downtime to transition back to UP
      if (e + 1 <= now) pts.push({ ts: e + 1, status: 1 });
    }

    // final point at now
    pts.push({ ts: now, status: currentStatus ? 1 : 0 });

    // dedupe by timestamp keeping last pushed (so transitions behave correctly)
    const map = new Map<number, ChartPoint>();
    for (const p of pts) map.set(p.ts, p);
    const final = Array.from(map.values()).sort((a, b) => a.ts - b.ts);

    return final;
  }, [downtimes, rangeStart, now, currentStatus]);

  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: { payload: ChartPoint }[];
  }) => {
    if (!active || !payload || !payload.length) return null;
    const d: ChartPoint = payload[0]?.payload;
    return (
      <div className="rounded-md border bg-white p-3 text-sm shadow">
        <div className="mb-1 font-medium">
          {new Date(d.ts).toLocaleString()}
        </div>
        <div
          className={
            d.status === 1
              ? "font-semibold text-green-600"
              : "font-semibold text-red-600"
          }>
          {d.status === 1 ? "Up" : "Down"}
        </div>
        {d.duration !== undefined && (
          <div className="mt-1 text-gray-600">
            Duration: {formatDuration(d.duration * 1000)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="mb-6 border-none p-0 shadow-none">
      <CardHeader>
        <CardTitle className="flex w-full items-center justify-between gap-4">
          <span>Status Overview</span>

          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1 Hour</SelectItem>
                <SelectItem value="3h">Last 3 Hours</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="12h">Last 12 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardTitle>

        <CardDescription className="flex flex-wrap gap-6">
          <span className="flex items-baseline gap-2">
            <span className="text-sm text-gray-600">Monitor interval</span>
            <span className="font-semibold">
              {formatDuration(interval * 1000)}
            </span>
          </span>

          <span className="flex items-baseline gap-2">
            <span className="text-sm text-gray-600">
              {request ? "Request timeout" : "Grace Period"}
            </span>
            <span className="font-semibold">
              {formatDuration(timeout * 1000)}
            </span>
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Metrics */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded border border-green-200 bg-green-50 p-4">
            <div className="text-sm text-gray-600">Uptime</div>
            <div className="text-2xl font-bold text-green-700">
              {metrics.uptimePercentage}%
            </div>
          </div>

          <div className="rounded border border-red-200 bg-red-50 p-4">
            <div className="text-sm text-gray-600">Total Downtime</div>
            <div className="text-2xl font-bold text-red-700">
              {metrics.totalDowntime}
            </div>
          </div>

          <div className="rounded border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm text-gray-600">Incidents</div>
            <div className="text-2xl font-bold text-blue-700">
              {metrics.downtimeCount}
            </div>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="statusGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e5e7eb"
            />

            <XAxis
              dataKey="ts"
              type="number"
              domain={[rangeStart, now]}
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: "#d1d5db" }}
            />

            <YAxis
              domain={[0, 1]}
              ticks={[0, 1]}
              tickFormatter={(v) => (v === 1 ? "Up" : "Down")}
              width={60}
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: "#d1d5db" }}
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine y={0.5} stroke="#e5e7eb" strokeDasharray="3 3" />

            <Area
              type="stepAfter"
              dataKey="status"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#statusGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ResponseTime;
