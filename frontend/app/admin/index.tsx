import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Header } from '../../components/Header';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Users, FileText, Settings, Activity } from 'lucide-react-native';

export default function AdminConsoleScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const { profile } = useAuth();

  return (
    <View className="flex-1" style={{ backgroundColor: activeColors.background }}>
      <Header title="Admin Console" showBack={true} />

      <ScrollView contentContainerStyle={{ padding: tokens.spacing.lg }}>
        {/* Admin Header Badge */}
        <View 
          className="rounded-2xl p-5 mb-6 border border-purple-500/30"
          style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
        >
          <View className="flex-row items-center mb-2">
            <ShieldCheck size={24} color="#a855f7" />
            <Text className="ml-2 font-bold" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg }}>
              Admin Privileges Active
            </Text>
          </View>
          <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm }}>
            Logged in as <Text className="font-semibold" style={{ color: activeColors.text.primary }}>{profile?.display_name}</Text> ({profile?.admin_role?.replace('_', ' ').toUpperCase()}).
          </Text>
        </View>

        {/* Management Grid */}
        <Text className="font-bold mb-4" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
          System Administration
        </Text>

        <View className="flex-row flex-wrap gap-4 mb-6">
          <TouchableOpacity 
            className="w-[47%] p-4 rounded-xl flex-col items-start"
            style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
          >
            <Users size={24} color={tokens.colors.light.brand} className="mb-2" />
            <Text className="font-bold mt-2" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
              User Audits
            </Text>
            <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs, marginTop: 2 }}>
              KYC & verification status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="w-[47%] p-4 rounded-xl flex-col items-start"
            style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
          >
            <Activity size={24} color={tokens.colors.semantic.success} className="mb-2" />
            <Text className="font-bold mt-2" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
              Rail Health
            </Text>
            <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs, marginTop: 2 }}>
              M-PESA / Bank adapters
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="w-[47%] p-4 rounded-xl flex-col items-start"
            style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
          >
            <FileText size={24} color="#f59e0b" className="mb-2" />
            <Text className="font-bold mt-2" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
              Audit Logs
            </Text>
            <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs, marginTop: 2 }}>
              System audit trails
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="w-[47%] p-4 rounded-xl flex-col items-start"
            style={{ backgroundColor: activeColors.surface, ...tokens.elevation[isDark ? 'dark' : 'light'].card }}
          >
            <Settings size={24} color="#6366f1" className="mb-2" />
            <Text className="font-bold mt-2" style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base }}>
              Global Rules
            </Text>
            <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs, marginTop: 2 }}>
              Fee limits & thresholds
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
