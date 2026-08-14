import React from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { StyleProp, TextStyle } from 'react-native';

export type IconName =
  | 'check-circle'
  | 'alert-circle'
  | 'clock'
  | 'arrow-right'
  | 'refresh-cw'
  | 'shield-check'
  | 'copy'
  | 'external-link'
  | 'user'
  | 'phone'
  | 'credit-card'
  | 'lock'
  | 'dollar-sign'
  | 'help-circle'
  | 'check'
  | 'x'
  | 'zap'
  | 'shield'
  | 'alert'
  | 'activity'
  | 'layers'
  | 'file-text';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 20, color = '#F8FAFC', style }: IconProps) {
  switch (name) {
    case 'shield-check':
      return <Ionicons name="shield-checkmark" size={size} color={color} style={style} />;
    case 'check-circle':
      return <Feather name="check-circle" size={size} color={color} style={style} />;
    case 'alert-circle':
    case 'alert':
      return <Feather name="alert-circle" size={size} color={color} style={style} />;
    case 'clock':
      return <Feather name="clock" size={size} color={color} style={style} />;
    case 'arrow-right':
      return <Feather name="arrow-right" size={size} color={color} style={style} />;
    case 'refresh-cw':
      return <Feather name="refresh-cw" size={size} color={color} style={style} />;
    case 'copy':
      return <Feather name="copy" size={size} color={color} style={style} />;
    case 'external-link':
      return <Feather name="external-link" size={size} color={color} style={style} />;
    case 'user':
      return <Feather name="user" size={size} color={color} style={style} />;
    case 'phone':
      return <Feather name="phone" size={size} color={color} style={style} />;
    case 'credit-card':
      return <Feather name="credit-card" size={size} color={color} style={style} />;
    case 'lock':
      return <Feather name="lock" size={size} color={color} style={style} />;
    case 'dollar-sign':
      return <Feather name="dollar-sign" size={size} color={color} style={style} />;
    case 'help-circle':
      return <Feather name="help-circle" size={size} color={color} style={style} />;
    case 'check':
      return <Feather name="check" size={size} color={color} style={style} />;
    case 'x':
      return <Feather name="x" size={size} color={color} style={style} />;
    case 'zap':
      return <Feather name="zap" size={size} color={color} style={style} />;
    case 'shield':
      return <Feather name="shield" size={size} color={color} style={style} />;
    case 'activity':
      return <Feather name="activity" size={size} color={color} style={style} />;
    case 'layers':
      return <Feather name="layers" size={size} color={color} style={style} />;
    case 'file-text':
      return <Feather name="file-text" size={size} color={color} style={style} />;
    default:
      return <Feather name="help-circle" size={size} color={color} style={style} />;
  }
}
