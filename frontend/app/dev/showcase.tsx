import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ThemeToggle } from '../../theme/ThemeToggle';

export default function ThemeShowcase() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  const renderColorBox = (name: string, color: string) => (
    <View key={name} className="flex-row items-center mb-2">
      <View style={{ backgroundColor: color, width: 40, height: 40, borderRadius: tokens.borderRadius.md }} />
      <View className="ml-3">
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.sm, fontWeight: '500' }}>{name}</Text>
        <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs }}>{color}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView 
      style={{ backgroundColor: activeColors.background }} 
      contentContainerStyle={{ padding: tokens.spacing.lg }}
    >
      <View className="flex-row justify-between items-center mb-6">
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.xl, fontWeight: 'bold' }}>
          Theme Showcase
        </Text>
        <ThemeToggle />
      </View>

      {/* Base Colors */}
      <View style={{ backgroundColor: activeColors.surface, padding: tokens.spacing.md, borderRadius: tokens.borderRadius.lg, marginBottom: tokens.spacing.lg }}>
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg, fontWeight: '600', marginBottom: tokens.spacing.md }}>Base Colors</Text>
        {renderColorBox('Brand', activeColors.brand)}
        {renderColorBox('Background', activeColors.background)}
        {renderColorBox('Surface', activeColors.surface)}
      </View>

      {/* Semantic Colors */}
      <View style={{ backgroundColor: activeColors.surface, padding: tokens.spacing.md, borderRadius: tokens.borderRadius.lg, marginBottom: tokens.spacing.lg }}>
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg, fontWeight: '600', marginBottom: tokens.spacing.md }}>Semantic</Text>
        {renderColorBox('Success', tokens.colors.semantic.success)}
        {renderColorBox('Warning', tokens.colors.semantic.warning)}
        {renderColorBox('Error', tokens.colors.semantic.error)}
        {renderColorBox('Info', tokens.colors.semantic.info)}
      </View>

      {/* Status Colors (Payment example) */}
      <View style={{ backgroundColor: activeColors.surface, padding: tokens.spacing.md, borderRadius: tokens.borderRadius.lg, marginBottom: tokens.spacing.lg }}>
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg, fontWeight: '600', marginBottom: tokens.spacing.md }}>Status: Expected Payment</Text>
        {renderColorBox('Open', tokens.colors.status.expectedPayment.open)}
        {renderColorBox('Partial', tokens.colors.status.expectedPayment.partial)}
        {renderColorBox('Paid', tokens.colors.status.expectedPayment.paid)}
        {renderColorBox('Overdue', tokens.colors.status.expectedPayment.overdue)}
        {renderColorBox('Cancelled', tokens.colors.status.expectedPayment.cancelled)}
      </View>

      {/* Typography */}
      <View style={{ backgroundColor: activeColors.surface, padding: tokens.spacing.md, borderRadius: tokens.borderRadius.lg, marginBottom: tokens.spacing.lg }}>
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg, fontWeight: '600', marginBottom: tokens.spacing.md }}>Typography</Text>
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size['2xl'], fontWeight: 'bold' }}>32px Bold Amount</Text>
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.xl, fontWeight: '600' }}>24px Semibold</Text>
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.lg, fontWeight: '500' }}>20px Medium</Text>
        <Text style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.base, fontWeight: '400' }}>16px Regular (Body)</Text>
        <Text style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.sm, fontWeight: '400' }}>14px Secondary</Text>
        <Text style={{ color: activeColors.text.muted, fontSize: tokens.typography.size.xs, fontWeight: '400' }}>12px Muted</Text>
      </View>

    </ScrollView>
  );
}
