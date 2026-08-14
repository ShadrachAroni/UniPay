import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  ArrowUp,
  ArrowDown,
  Building2,
  Smartphone,
  Wallet,
  Star,
} from 'lucide-react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Header } from '../components/ui/Header';
import {
  getMoneyDirectionRules,
  updateMoneyDirectionRule,
} from '../api/moneyDirection';
import { MoneyDirectionRule } from '../api/types';
import { useToast } from '../components/ui/Toast';

export default function MoneyDirectionScreen() {
  const { tokens, isDark, activeColors } = useTheme();
  const { showToast } = useToast();

  const [rules, setRules] = useState<MoneyDirectionRule[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getMoneyDirectionRules();
      setRules(data.sort((a, b) => a.priority_order - b.priority_order));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const setAsPrimary = async (targetIndex: number) => {
    if (targetIndex === 0) {
      return;
    }

    const newRules = [...rules];
    const selected = newRules.splice(targetIndex, 1)[0];
    newRules.unshift(selected);

    newRules.forEach((r, idx) => {
      r.priority_order = idx + 1;
    });

    setRules(newRules);
    showToast(
      `${selected.destination_type.replace('_', ' ').toUpperCase()} set as Primary Preferred Choice`,
      'success',
    );
  };

  const moveRule = async (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= rules.length) {
      return;
    }

    const newRules = [...rules];
    const temp = newRules[index];
    newRules[index] = newRules[index + direction];
    newRules[index + direction] = temp;

    newRules.forEach((r, idx) => {
      r.priority_order = idx + 1;
    });

    setRules([...newRules]);

    try {
      await updateMoneyDirectionRule(newRules[index].id, {
        priority_order: index + 1,
      });
      await updateMoneyDirectionRule(newRules[index + direction].id, {
        priority_order: index + direction + 1,
      });
      showToast('Priority routing updated', 'success');
    } catch {
      showToast('Failed to update priority', 'error');
      load();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return Building2;
      case 'mobile_money':
        return Smartphone;
      default:
        return Wallet;
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Money Direction" />

      <ScrollView
        contentContainerStyle={{ padding: tokens.spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.light.brand}
          />
        }
      >
        <Text
          style={{
            color: activeColors.text.secondary,
            fontSize: tokens.typography.size.base,
            marginBottom: tokens.spacing.xl,
          }}
        >
          Choose your{' '}
          <Text className="font-bold" style={{ color: activeColors.text.primary }}>
            Preferred Primary Choice
          </Text>{' '}
          where incoming funds arrive first. Priority rules execute top-to-bottom.
        </Text>

        {rules.map((rule, index) => {
          const Icon = getIcon(rule.destination_type);
          const isPrimary = index === 0;

          return (
            <View
              key={rule.id}
              className={`rounded-2xl p-4 mb-4 border ${
                isPrimary
                  ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 shadow-lg'
                  : 'border-gray-200 dark:border-slate-800 opacity-90'
              }`}
              style={{
                backgroundColor: isPrimary
                  ? isDark
                    ? 'rgba(30, 58, 138, 0.3)'
                    : '#eff6ff'
                  : activeColors.surface,
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                      isPrimary ? 'bg-blue-600' : 'bg-gray-100 dark:bg-slate-800'
                    }`}
                  >
                    <Icon size={20} color={isPrimary ? '#ffffff' : activeColors.text.primary} />
                  </View>
                  <View>
                    <Text
                      className={`font-bold ${isPrimary ? 'text-base text-blue-900 dark:text-blue-200' : 'text-sm'}`}
                      style={{ color: isPrimary ? undefined : activeColors.text.primary }}
                    >
                      {rule.destination_type.replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text
                      style={{
                        color: activeColors.text.secondary,
                        fontSize: tokens.typography.size.xs,
                      }}
                    >
                      {isPrimary
                        ? 'Default Primary Destination'
                        : `Fallback Priority #${index + 1}`}
                    </Text>
                  </View>
                </View>

                {isPrimary ? (
                  <View className="px-3 py-1 rounded-full bg-blue-600 flex-row items-center">
                    <Star size={12} color="#ffffff" />
                    <Text className="text-[10px] font-bold text-white uppercase ml-1">
                      PREFERRED
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setAsPrimary(index)}
                    className="px-2.5 py-1 rounded-lg border border-blue-400 bg-blue-50 dark:bg-blue-950"
                  >
                    <Text className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      Set as Primary
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View
                className="flex-row items-center justify-between pt-3 mt-1 border-t border-gray-200/60 dark:border-slate-800/60"
              >
                <View className="flex-row items-center">
                  <Text
                    style={{
                      color: activeColors.text.secondary,
                      fontSize: tokens.typography.size.xs,
                      marginRight: 8,
                    }}
                  >
                    Allocation:
                  </Text>
                  <Text
                    className="font-bold text-xs"
                    style={{ color: activeColors.text.primary }}
                  >
                    {rule.allocation_type === 'percentage'
                      ? `${rule.allocation_value}% of incoming`
                      : `Fixed KES ${rule.allocation_value.toLocaleString()}`}
                  </Text>
                </View>

                <View className="flex-row items-center gap-1">
                  <TouchableOpacity
                    onPress={() => moveRule(index, -1)}
                    disabled={index === 0}
                    className={`p-1.5 rounded ${index === 0 ? 'opacity-30' : 'bg-gray-100 dark:bg-slate-800'}`}
                  >
                    <ArrowUp size={16} color={activeColors.text.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => moveRule(index, 1)}
                    disabled={index === rules.length - 1}
                    className={`p-1.5 rounded ${index === rules.length - 1 ? 'opacity-30' : 'bg-gray-100 dark:bg-slate-800'}`}
                  >
                    <ArrowDown size={16} color={activeColors.text.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
