import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useDemoAuth, DEMO_PERSONAS, DemoPersona } from '../../context/DemoAuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { useToast } from './Toast';
import { useRouter } from 'expo-router';
import { UserCheck, Shield, ChevronDown, Check, Sparkles, Building2, User } from 'lucide-react-native';

export function PersonaSwitcher({ compact = false }: { compact?: boolean }) {
  const { currentPersona, switchPersona, isClerkSignedIn } = useDemoAuth();
  const { tokens, isDark, activeColors } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = async (persona: DemoPersona) => {
    await switchPersona(persona.id);
    showToast(`Switched persona to ${persona.name} (${persona.alias})`, 'success');
    setIsOpen(false);
    if (persona.isAdmin) {
      router.push('/admin');
    }
  };

  return (
    <View
      className="rounded-2xl border mb-4 overflow-hidden"
      style={{
        backgroundColor: isDark ? tokens.colors.dark.surface : '#f8fafc',
        borderColor: activeColors.border,
        ...tokens.elevation[isDark ? 'dark' : 'light'].card,
      }}
    >
      {/* Header bar */}
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
        className="flex-row items-center justify-between p-3.5"
      >
        <View className="flex-row items-center flex-1 mr-2">
          <View
            className="w-9 h-9 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: currentPersona.avatarColor }}
          >
            {currentPersona.isAdmin ? (
              <Shield size={18} color="#ffffff" />
            ) : currentPersona.role === 'business' ? (
              <Building2 size={18} color="#ffffff" />
            ) : (
              <User size={18} color="#ffffff" />
            )}
          </View>

          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text
                className="font-bold text-xs"
                style={{ color: activeColors.text.primary }}
                numberOfLines={1}
              >
                {currentPersona.name}
              </Text>
              <View
                className="px-1.5 py-0.2 rounded"
                style={{
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0e7ff',
                }}
              >
                <Text
                  style={{
                    color: activeColors.brand,
                    fontSize: 9,
                    fontWeight: '700',
                  }}
                >
                  {currentPersona.badge}
                </Text>
              </View>
            </View>

            <Text
              style={{ color: activeColors.text.secondary, fontSize: 11, marginTop: 1 }}
              numberOfLines={1}
            >
              {currentPersona.alias} · {currentPersona.description}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <View
            className="px-2.5 py-1 rounded-lg border flex-row items-center"
            style={{
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              borderColor: activeColors.border,
            }}
          >
            <Sparkles size={12} color={activeColors.brand} />
            <Text className="ml-1 text-xs font-bold" style={{ color: activeColors.brand }}>
              Switch Demo
            </Text>
            <ChevronDown
              size={14}
              color={activeColors.text.secondary}
              style={{
                marginLeft: 4,
                transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
              }}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded Persona List */}
      {isOpen && (
        <View
          className="border-t p-2 gap-1.5"
          style={{
            borderColor: activeColors.borderSubtle,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
          }}
        >
          <Text
            className="px-2 py-1 font-semibold text-[11px] uppercase tracking-wider"
            style={{ color: activeColors.text.muted }}
          >
            Select Persona to Experience UniPay:
          </Text>

          {DEMO_PERSONAS.map((persona) => {
            const isSelected = currentPersona.id === persona.id;

            return (
              <TouchableOpacity
                key={persona.id}
                onPress={() => handleSelect(persona)}
                activeOpacity={0.7}
                className="flex-row items-center justify-between p-2.5 rounded-xl border"
                style={{
                  backgroundColor: isSelected
                    ? (isDark ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff')
                    : (isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc'),
                  borderColor: isSelected ? activeColors.brand : 'transparent',
                }}
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center mr-2.5"
                    style={{ backgroundColor: persona.avatarColor }}
                  >
                    {persona.isAdmin ? (
                      <Shield size={16} color="#ffffff" />
                    ) : persona.role === 'business' ? (
                      <Building2 size={16} color="#ffffff" />
                    ) : (
                      <User size={16} color="#ffffff" />
                    )}
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        className="font-bold text-xs"
                        style={{ color: activeColors.text.primary }}
                      >
                        {persona.name}
                      </Text>
                      <Text className="font-mono text-[10px]" style={{ color: activeColors.brand }}>
                        {persona.alias}
                      </Text>
                    </View>
                    <Text
                      style={{ color: activeColors.text.secondary, fontSize: 10, marginTop: 1 }}
                      numberOfLines={1}
                    >
                      {persona.description}
                    </Text>
                  </View>
                </View>

                {isSelected ? (
                  <View
                    className="w-5 h-5 rounded-full items-center justify-center"
                    style={{ backgroundColor: activeColors.brand }}
                  >
                    <Check size={12} color="#ffffff" />
                  </View>
                ) : (
                  <View
                    className="px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      borderColor: activeColors.border,
                    }}
                  >
                    <Text style={{ color: activeColors.text.muted, fontSize: 9, fontWeight: '600' }}>
                      Select
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
