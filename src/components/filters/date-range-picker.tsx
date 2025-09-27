'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DateRange, DATE_PRESETS } from '@/lib/types';
import { getDateRangePreset } from '@/lib/data-utils';

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (dateRange: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ dateRange, onDateRangeChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('last_28_days');

  const handlePresetChange = (preset: string) => {
    console.log('📅 DateRangePicker preset changed:', {
      oldPreset: selectedPreset,
      newPreset: preset,
      isCustom: preset === DATE_PRESETS.CUSTOM
    });
    
    setSelectedPreset(preset);
    if (preset !== DATE_PRESETS.CUSTOM) {
      const newDateRange = getDateRangePreset(preset);
      console.log('📅 DateRangePicker calling onDateRangeChange:', {
        preset,
        newDateRange,
        daysDifference: newDateRange.startDate && newDateRange.endDate 
          ? Math.ceil((new Date(newDateRange.endDate).getTime() - new Date(newDateRange.startDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0
      });
      onDateRangeChange(newDateRange);
    }
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', date: Date | undefined) => {
    if (date) {
      const newDateRange = {
        ...dateRange,
        [field]: format(date, 'yyyy-MM-dd'),
      };
      onDateRangeChange(newDateRange);
      setSelectedPreset(DATE_PRESETS.CUSTOM);
    }
  };

  const formatDateRange = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return 'Select date range';
    }
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Select date range';
    }
    return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd, yyyy')}`;
  };

  return (
    <div className={cn('flex flex-col space-y-2', className)}>
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select date range" />
        </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DATE_PRESETS.LAST_24_HOURS}>Last 24 hours</SelectItem>
                  <SelectItem value={DATE_PRESETS.LAST_7_DAYS}>Last 7 days</SelectItem>
                  <SelectItem value={DATE_PRESETS.LAST_28_DAYS}>Last 28 days</SelectItem>
                  <SelectItem value={DATE_PRESETS.LAST_3_MONTHS}>Last 3 months</SelectItem>
                  <SelectItem value={DATE_PRESETS.LAST_6_MONTHS}>Last 6 months</SelectItem>
                  <SelectItem value={DATE_PRESETS.LAST_12_MONTHS}>Last 12 months</SelectItem>
                  <SelectItem value={DATE_PRESETS.LAST_16_MONTHS}>Last 16 months</SelectItem>
                  <SelectItem value={DATE_PRESETS.CUSTOM}>Custom</SelectItem>
                </SelectContent>
      </Select>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[280px] justify-start text-left font-normal',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange ? formatDateRange() : <span>Pick a date range</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="p-3 border-r">
              <div className="text-sm font-medium mb-2">Start Date</div>
              <Calendar
                mode="single"
                selected={dateRange.startDate ? new Date(dateRange.startDate) : undefined}
                onSelect={(date) => handleCustomDateChange('startDate', date)}
                disabled={(date) => date > new Date() || date < new Date('2020-01-01')}
                initialFocus
              />
            </div>
            <div className="p-3">
              <div className="text-sm font-medium mb-2">End Date</div>
              <Calendar
                mode="single"
                selected={dateRange.endDate ? new Date(dateRange.endDate) : undefined}
                onSelect={(date) => handleCustomDateChange('endDate', date)}
                disabled={(date) => 
                  date > new Date() || 
                  (dateRange.startDate && date < new Date(dateRange.startDate)) || 
                  date < new Date('2020-01-01')
                }
                initialFocus
              />
            </div>
          </div>
          <div className="p-3 border-t">
            <Button 
              onClick={() => setIsOpen(false)} 
              className="w-full"
              size="sm"
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
