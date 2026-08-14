import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Chip } from './Chip';
import {
  DateRange,
  DEFAULT_PRESETS,
  PresetKey,
  PresetOption,
  UTCRange,
  formatDateRange,
  getCalendarGrid,
  getDayNames,
  getDeviceTimezoneOffsetHours,
  getMonthName,
  getPresetRange,
  isAfterToday,
  isInRange,
  isSameDay,
  toUTCRange,
} from '../utils/dateUtils';

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onUTCRangeChange?: (range: UTCRange) => void;
  disableFuture?: boolean;
  locale?: 'en' | 'sw';
  timezoneOffsetHours?: number;
  presets?: PresetOption[];
  label?: string;
  style?: ViewStyle;
}

export function DateRangePicker({
  value,
  onChange,
  onUTCRangeChange,
  disableFuture = true,
  locale = 'en',
  timezoneOffsetHours,
  presets = DEFAULT_PRESETS,
  label,
  style,
}: DateRangePickerProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const tzOffset = timezoneOffsetHours ?? getDeviceTimezoneOffsetHours();

  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [tempStart, setTempStart] = useState<Date | null>(value.startDate);
  const [tempEnd, setTempEnd] = useState<Date | null>(value.endDate);

  const handlePreset = useCallback(
    (preset: PresetKey) => {
      if (preset === 'custom') {
        setActivePreset('custom');
        setTempStart(value.startDate);
        setTempEnd(value.endDate);
        setCalendarVisible(true);
        return;
      }

      setActivePreset(preset);
      const range = getPresetRange(preset);
      onChange(range);

      if (onUTCRangeChange && range.startDate && range.endDate) {
        onUTCRangeChange(toUTCRange(range.startDate, range.endDate, tzOffset));
      }
    },
    [onChange, onUTCRangeChange, tzOffset, value.endDate, value.startDate],
  );

  const handleDayPress = useCallback(
    (day: number) => {
      const pressed = new Date(viewYear, viewMonth, day);
      if (disableFuture && isAfterToday(pressed)) return;

      if (!tempStart || (tempStart && tempEnd)) {
        setTempStart(pressed);
        setTempEnd(null);
      } else if (pressed.getTime() < tempStart.getTime()) {
        setTempEnd(tempStart);
        setTempStart(pressed);
      } else {
        setTempEnd(pressed);
      }
    },
    [disableFuture, tempEnd, tempStart, viewMonth, viewYear],
  );

  const applyCustomRange = useCallback(() => {
    if (!tempStart || !tempEnd) return;
    const range: DateRange = { startDate: tempStart, endDate: tempEnd };
    onChange(range);
    if (onUTCRangeChange) {
      onUTCRangeChange(toUTCRange(tempStart, tempEnd, tzOffset));
    }
    setCalendarVisible(false);
  }, [onChange, onUTCRangeChange, tempEnd, tempStart, tzOffset]);

  const calendarGrid = useMemo(() => getCalendarGrid(viewYear, viewMonth), [viewMonth, viewYear]);
  const dayNames = useMemo(() => getDayNames(locale), [locale]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
      return;
    }
    setViewMonth(viewMonth - 1);
  };

  const goToNextMonth = () => {
    if (disableFuture) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      if (nextYear > now.getFullYear() || (nextYear === now.getFullYear() && nextMonth > now.getMonth())) {
        return;
      }
    }

    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
      return;
    }
    setViewMonth(viewMonth + 1);
  };

  const getDayCellStyle = (day: number | null) => {
    if (day === null) return {};
    const date = new Date(viewYear, viewMonth, day);
    const disabled = disableFuture && isAfterToday(date);
    const isStart = tempStart && isSameDay(date, tempStart);
    const isEnd = tempEnd && isSameDay(date, tempEnd);
    const inRange = tempStart && tempEnd && isInRange(date, tempStart, tempEnd);

    if (disabled) {
      return {
        bg: 'transparent',
        text: activeColors.text.muted,
        opacity: 0.35,
      };
    }

    if (isStart || isEnd) {
      return {
        bg: activeColors.brand,
        text: '#ffffff',
        opacity: 1,
      };
    }

    if (inRange) {
      return {
        bg: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.12)',
        text: activeColors.brand,
        opacity: 1,
      };
    }

    return {
      bg: 'transparent',
      text: activeColors.text.primary,
      opacity: 1,
    };
  };

  return (
    <View style={style}>
      {label ? (
        <Text
          style={{
            color: activeColors.text.secondary,
            fontSize: tokens.typography.size.xs,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {presets.map((preset) => (
          <Chip
            key={preset.key}
            label={preset.label[locale]}
            selected={activePreset === preset.key}
            onPress={() => handlePreset(preset.key)}
          />
        ))}
      </ScrollView>

      {value.startDate ? (
        <TouchableOpacity
          className="flex-row items-center mt-2 gap-1.5"
          onPress={() => {
            setActivePreset('custom');
            setTempStart(value.startDate);
            setTempEnd(value.endDate);
            setCalendarVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Calendar size={14} color={activeColors.brand} />
          <Text
            style={{
              color: activeColors.brand,
              fontSize: tokens.typography.size.xs,
              fontWeight: '500',
            }}
          >
            {formatDateRange(value.startDate, value.endDate, locale)}
          </Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={calendarVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <View
            style={{
              width: '100%',
              maxWidth: 380,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: activeColors.border,
              backgroundColor: activeColors.surface,
              padding: 16,
            }}
          >
            <View className="flex-row justify-between items-center pb-3 mb-3 border-b" style={{ borderColor: activeColors.border }}>
              <Text className="font-bold text-lg" style={{ color: activeColors.text.primary }}>
                {locale === 'sw' ? 'Chagua Tarehe' : 'Select Date Range'}
              </Text>
              <TouchableOpacity
                onPress={() => setCalendarVisible(false)}
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={activeColors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center justify-between mb-3">
              <TouchableOpacity
                onPress={goToPrevMonth}
                className="p-2 rounded-lg"
                style={{ backgroundColor: isDark ? activeColors.border : '#f1f5f9' }}
              >
                <ChevronLeft size={20} color={activeColors.text.primary} />
              </TouchableOpacity>
              <Text className="font-bold text-base" style={{ color: activeColors.text.primary }}>
                {getMonthName(viewMonth, locale)} {viewYear}
              </Text>
              <TouchableOpacity
                onPress={goToNextMonth}
                className="p-2 rounded-lg"
                style={{ backgroundColor: isDark ? activeColors.border : '#f1f5f9' }}
              >
                <ChevronRight size={20} color={activeColors.text.primary} />
              </TouchableOpacity>
            </View>

            <View className="flex-row mb-1">
              {dayNames.map((name, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                  <Text
                    style={{
                      color: activeColors.text.muted,
                      fontSize: 11,
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}
                  >
                    {name}
                  </Text>
                </View>
              ))}
            </View>

            {calendarGrid.map((week, rowIdx) => (
              <View key={rowIdx} className="flex-row">
                {week.map((day, colIdx) => {
                  const cellStyle = getDayCellStyle(day);
                  const isDisabled = day !== null && disableFuture && isAfterToday(new Date(viewYear, viewMonth, day));

                  return (
                    <TouchableOpacity
                      key={colIdx}
                      onPress={() => day !== null && !isDisabled && handleDayPress(day)}
                      disabled={day === null || isDisabled}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 10,
                        minHeight: 44,
                        borderRadius: 8,
                        backgroundColor: cellStyle.bg || 'transparent',
                        opacity: cellStyle.opacity ?? 1,
                      }}
                    >
                      {day !== null ? (
                        <Text
                          style={{
                            color: cellStyle.text || activeColors.text.primary,
                            fontSize: tokens.typography.size.sm,
                            fontWeight: '500',
                          }}
                        >
                          {day}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <View className="mt-3 pt-3 border-t" style={{ borderColor: activeColors.border }}>
              <Text className="text-center mb-3" style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
                {formatDateRange(tempStart, tempEnd, locale)}
              </Text>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => {
                    setTempStart(null);
                    setTempEnd(null);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: activeColors.border,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: activeColors.text.secondary, fontWeight: '600' }}>{locale === 'sw' ? 'Futa' : 'Clear'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={applyCustomRange}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    backgroundColor: activeColors.brand,
                    paddingVertical: 10,
                    alignItems: 'center',
                    opacity: tempStart && tempEnd ? 1 : 0.5,
                  }}
                  disabled={!(tempStart && tempEnd)}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '700' }}>{locale === 'sw' ? 'Tumia' : 'Apply'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
