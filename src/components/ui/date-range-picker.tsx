"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

interface DateRangePickerProps {
  label?: string;
  from?: string;
  to?: string;
  onChange: (range: { from: string; to: string }) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  label,
  from,
  to,
  onChange,
  placeholder = "Selecionar periodo",
  className,
}: DateRangePickerProps) {
  const value = React.useMemo<DateRange | undefined>(
    () => ({
      from: parseDate(from),
      to: parseDate(to),
    }),
    [from, to],
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label>{label}</Label> : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-11 w-full justify-start rounded-2xl px-4 text-left font-normal"
          >
            <CalendarIcon className="mr-2 size-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "dd/MM/yyyy")} - {format(value.to, "dd/MM/yyyy")}
                </>
              ) : (
                format(value.from, "dd/MM/yyyy")
              )
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={(nextValue) =>
              onChange({
                from: nextValue?.from ? format(nextValue.from, "yyyy-MM-dd") : "",
                to: nextValue?.to ? format(nextValue.to, "yyyy-MM-dd") : "",
              })
            }
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
