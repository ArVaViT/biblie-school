type EventColorPalette = {
  dot: string;
  bg: string;
  text: string;
  border: string;
};

export const EVENT_COLORS: Record<string, EventColorPalette> = {
  deadline: {
    dot: "bg-destructive",
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
  },
  live_session: {
    dot: "bg-info",
    bg: "bg-info/10",
    text: "text-info",
    border: "border-info/30",
  },
  exam: {
    dot: "bg-warning",
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/30",
  },
  other: {
    dot: "bg-muted-foreground/50",
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
};

const FALLBACK_EVENT_COLOR: EventColorPalette = {
  dot: "bg-muted-foreground/50",
  bg: "bg-muted",
  text: "text-muted-foreground",
  border: "border-border",
};

export function getEventColor(type: string): EventColorPalette {
  return EVENT_COLORS[type] ?? FALLBACK_EVENT_COLOR;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
