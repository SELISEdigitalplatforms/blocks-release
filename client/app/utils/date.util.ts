import { isValid as isValidDate, isBefore } from "date-fns";

const pad = (num: number): string => num.toString().padStart(2, "0");

export const formatDate = (date: Date, withoutTime?: boolean): string => {
  const dateStr = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (withoutTime) return `${dateStr}`;
  return `${dateStr}, ${timeStr}`;
};

export const formatFullDate = (date: Date, withoutTime?: boolean): string => {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dateStr = `${monthNames[date.getMonth()]} ${pad(date.getDate())}, ${date.getFullYear()}`;
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (withoutTime) return dateStr;
  return `${dateStr} at ${timeStr}`;
};

export function parseDateString(dateString: string): Date {
  return new Date(dateString);
}

export function compareDates(dateStringA: string, dateStringB: string): number {
  const dateA = new Date(dateStringA);
  const dateB = new Date(dateStringB);
  return dateA.getTime() - dateB.getTime();
}

export const checkValidDate = (date: string | Date) => {
  const isValid = isValidDate(new Date(date));
  if (!isValid) return false;
  const targetDate = new Date("1900-01-01");
  if (isBefore(new Date(date), targetDate)) return false;
  return true;
};
