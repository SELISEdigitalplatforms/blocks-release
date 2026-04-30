import { Card } from "@/components/ui-kits/card/card";
import { IIncidentSummaries } from "@blocks-devops/models/alerts";
import React, { useState, useMemo } from "react";

type IProgressBar = {
  incidents: IIncidentSummaries[];
  status: boolean;
};

type TimeSlot = {
  startTime: Date;
  endTime: Date;
  downtimePercentage: number;
};

const ProgressBar = ({ incidents, status }: IProgressBar) => {
  const timeSlots = useMemo(() => {
    const slots: TimeSlot[] = [];
    const now = new Date();

    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();

    for (let i = 23; i >= 0; i--) {
      const slotEnd = new Date(now);
      slotEnd.setHours(currentHour, currentMinute, 0, 0);
      slotEnd.setHours(slotEnd.getHours() - i);

      const slotStart = new Date(slotEnd);
      slotStart.setHours(slotStart.getHours() - 1);

      let downtimePercentage: number;
      if (incidents.length === 0) {
        downtimePercentage = status ? 0 : 100;
      } else {
        downtimePercentage = calculateDowntimePercentage(slotStart, slotEnd, incidents);
      }

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        downtimePercentage,
      });
    }

    return slots;
  }, [incidents, status]);

  const progress = useMemo(() => {
    const totalDowntime = timeSlots.reduce((sum, slot) => sum + slot.downtimePercentage, 0);
    const averageDowntime = totalDowntime / timeSlots.length;
    return Math.floor(100 - averageDowntime);
  }, [timeSlots]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-[2px]">
        {timeSlots.map((slot, index) => (
          <IndividualBar
            key={index}
            status={slot.downtimePercentage === 0}
            startTime={slot.startTime}
            endTime={slot.endTime}
            downtimePercentage={slot.downtimePercentage}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-medium-emphasis">{progress}%</span>
    </div>
  );
};

const IndividualBar = ({
  status,
  startTime,
  endTime,
  downtimePercentage,
}: {
  status: boolean;
  startTime: Date;
  endTime: Date;
  downtimePercentage: number;
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="relative">
      <div
        className={`h-6 w-[4.4px] rounded-[2px] ${
          status ? "bg-green-500 hover:bg-green-700" : "bg-red-500 hover:bg-red-700"
        }`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      />

      {showTooltip && (
        <Card className="pointer-events-none absolute bottom-full right-1/3 z-50 whitespace-nowrap">
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex gap-2">
              <span>{formatDate(startTime)}</span>
              <span>
                {formatTime(startTime)} - {formatTime(endTime)}
              </span>
            </div>
            <span className="font-semibold">
              {status ? "Up " : "Down "}
              {status ? "100" : downtimePercentage.toFixed(1)}%
            </span>
          </div>
        </Card>
      )}
    </div>
  );
};

function calculateDowntimePercentage(
  slotStart: Date,
  slotEnd: Date,
  incidents: IIncidentSummaries[],
): number {
  const slotDuration = slotEnd.getTime() - slotStart.getTime();
  let totalDowntime = 0;
  const now = new Date();

  incidents.forEach((incident) => {
    const incidentStart = new Date(incident.startTime);
    // If endTime is null, treat it as an ongoing incident (use current time)
    const incidentEnd = incident.endTime ? new Date(incident.endTime) : now;

    // Check if incident overlaps with this slot
    const overlapStart = new Date(Math.max(slotStart.getTime(), incidentStart.getTime()));
    const overlapEnd = new Date(Math.min(slotEnd.getTime(), incidentEnd.getTime()));

    if (overlapStart < overlapEnd) {
      const overlapDuration = overlapEnd.getTime() - overlapStart.getTime();
      totalDowntime += overlapDuration;
    }
  });

  return Math.min((totalDowntime / slotDuration) * 100, 100);
}

export default ProgressBar;
