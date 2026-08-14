import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Header } from '../components/Header';
import { getMoneyDirectionRules, updateMoneyDirectionRule } from '../api/moneyDirection';
import { MoneyDirectionRule } from '../api/types';
import { ArrowUp, ArrowDown, Building2, Smartphone, Wallet } from 'lucide-react-native';
import { useToast } from '../components/Toast';

export default function MoneyDirectionScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const { showToast } = useToast();

  const [rules, setRules] = useState<MoneyDirectionRule[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getMoneyDirectionRules();
      // Sort by priority order
      setRules(data.sort((a, b) => a.priority_order - b.priority_order));
    } catch (e) {
      console.error(e);
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

  const moveRule = async (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= rules.length) return;
    
    const newRules = [...rules];
    // Swap
    const temp = newRules[index];
    newRules[index] = newRules[index + direction];
    newRules[index + direction] = temp;
    
    // Update local state for immediate feedback
    setRules(newRules);

    try {
      // Simulate API updates
      await updateMoneyDirectionRule(newRules[index].id, { priority_order: index + 1 });
      await updateMoneyDirectionRule(newRules[index + direction].id, { priority_order: index + direction + 1 });
      showToast('Priority updated', 'success');
    } catch (e) {
      showToast('Failed to update priority', 'error');
      load(); // revert
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'bank': return Building2;
      case 'mobile_money': return Smartphone;
      default: return Wallet;
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Money Direction" />

      <ScrollView 
        contentContainerStyle={{ padding: tokens.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.light.brand} />}
      >
        <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.base, marginBottom: tokens.spacing.xl }}>
          Configure how incoming funds are automatically routed across your accounts. Rules execute in order of priority.
        </Text>

        {rules.map((rule, index) => {
          const Icon = getIcon(rule.destination_type);
          return (
            <View 
              key={rule.id}
              className="rounded-xl p-4 mb-4 flex-row items-center"
              style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
            >
              {/* Up/Down Arrows */}
              <View className="mr-4 items-center">
                <TouchableOpacity 
                  onPress={() => moveRule(index, -1)} 
                  disabled={index === 0}
                  className="p-1 mb-1"
                >
                  <ArrowUp size={20} color={index === 0 ? activeColors.border : activeColors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => moveRule(index, 1)} 
                  disabled={index === rules.length - 1}
                  className="p-1"
                >
                  <ArrowDown size={20} color={index === rules.length - 1 ? activeColors.border : activeColors.text.primary} />
                </TouchableOpacity>
              </View>

              {/* Icon */}
              <View 
                className="w-12 h-12 rounded-full items-center justify-center mr-4"
                style={{ backgroundColor: `${tokens.colors.light.brand}20` }}
              >
                <Icon size={24} color={tokens.colors.light.brand} />
              </View>

              {/* Details */}
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
                  {rule.destination_type.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, marginTop: 4 }}>
                  Allocation: <Text style={{ color: activeColors.text.primary, fontWeight: '600' }}>
                    {rule.allocation_type === 'percentage' ? `${rule.allocation_value}%` : `KES ${rule.allocation_value.toLocaleString()}`}
                  </Text>
                </Text>
              </View>

              {/* Status Indicator */}
              <View 
                className="w-3 h-3 rounded-full ml-3"
                style={{ backgroundColor: rule.is_active ? tokens.colors.semantic.success : tokens.colors.semantic.error }}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
