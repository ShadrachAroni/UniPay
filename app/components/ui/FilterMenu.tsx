import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheet, BottomSheetModal } from './BottomSheet';
import { Chip } from './Chip';
import { Divider } from './Divider';
import { useTheme } from '../../theme/ThemeProvider';

export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterGroup {
  id: string;
  title: string;
  options: FilterOption[];
  isMulti?: boolean;
}

interface FilterMenuProps {
  groups: FilterGroup[];
  selectedFilters: Record<string, string[]>;
  onFilterChange: (groupId: string, optionId: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export const FilterMenu = React.forwardRef<BottomSheetModal, FilterMenuProps>(
  ({ groups, selectedFilters, onFilterChange, onApply, onClear }, ref) => {
    const { tokens, activeColors } = useTheme();

    return (
      <BottomSheet ref={ref} snapPoints={['60%', '80%']}>
        <View className="flex-1 px-4 py-2">
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="font-bold"
              style={{
                color: activeColors.text.primary,
                fontSize: tokens.typography.size.lg,
              }}
            >
              Filters
            </Text>
            <TouchableOpacity onPress={onClear}>
              <Text
                className="font-medium"
                style={{
                  color: tokens.colors.semantic.info,
                  fontSize: tokens.typography.size.sm,
                }}
              >
                Clear all
              </Text>
            </TouchableOpacity>
          </View>

          <Divider style={{ marginBottom: tokens.spacing.md }} />

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {groups.map((group) => (
              <View key={group.id} className="mb-6">
                <Text
                  className="font-semibold mb-3"
                  style={{
                    color: activeColors.text.primary,
                    fontSize: tokens.typography.size.base,
                  }}
                >
                  {group.title}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {group.options.map((option) => {
                    const isSelected =
                      selectedFilters[group.id]?.includes(option.id) || false;
                    return (
                      <Chip
                        key={option.id}
                        label={option.label}
                        selected={isSelected}
                        onPress={() => onFilterChange(group.id, option.id)}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View className="pt-4 pb-8 border-t" style={{ borderColor: activeColors.border }}>
            <TouchableOpacity
              onPress={onApply}
              className="w-full items-center justify-center py-3 rounded-lg"
              style={{ backgroundColor: activeColors.brand }}
            >
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: tokens.typography.size.base,
                  fontWeight: '600',
                }}
              >
                Apply Filters
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    );
  },
);
