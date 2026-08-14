import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Copy,
  ExternalLink,
  User,
  Phone,
  CreditCard,
  Lock,
  DollarSign,
  HelpCircle,
  Check,
  X,
  Zap,
  Shield,
  AlertTriangle,
  Activity,
  Layers,
  FileText,
  Building2,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Settings,
  Plus,
  QrCode,
  Smartphone,
  Eye,
  Filter,
} from 'lucide-react-native';

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
  | 'file-text'
  | 'building'
  | 'bell'
  | 'search'
  | 'chevron-left'
  | 'chevron-right'
  | 'trending-up'
  | 'settings'
  | 'plus'
  | 'qr-code'
  | 'smartphone'
  | 'eye'
  | 'filter';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Icon({ name, size = 20, color = '#F8FAFC', style }: IconProps) {
  switch (name) {
    case 'shield-check':
      return <ShieldCheck size={size} color={color} style={style} />;
    case 'check-circle':
      return <CheckCircle2 size={size} color={color} style={style} />;
    case 'alert-circle':
      return <AlertCircle size={size} color={color} style={style} />;
    case 'alert':
      return <AlertTriangle size={size} color={color} style={style} />;
    case 'clock':
      return <Clock size={size} color={color} style={style} />;
    case 'arrow-right':
      return <ArrowRight size={size} color={color} style={style} />;
    case 'refresh-cw':
      return <RefreshCw size={size} color={color} style={style} />;
    case 'copy':
      return <Copy size={size} color={color} style={style} />;
    case 'external-link':
      return <ExternalLink size={size} color={color} style={style} />;
    case 'user':
      return <User size={size} color={color} style={style} />;
    case 'phone':
      return <Phone size={size} color={color} style={style} />;
    case 'credit-card':
      return <CreditCard size={size} color={color} style={style} />;
    case 'lock':
      return <Lock size={size} color={color} style={style} />;
    case 'dollar-sign':
      return <DollarSign size={size} color={color} style={style} />;
    case 'help-circle':
      return <HelpCircle size={size} color={color} style={style} />;
    case 'check':
      return <Check size={size} color={color} style={style} />;
    case 'x':
      return <X size={size} color={color} style={style} />;
    case 'zap':
      return <Zap size={size} color={color} style={style} />;
    case 'shield':
      return <Shield size={size} color={color} style={style} />;
    case 'activity':
      return <Activity size={size} color={color} style={style} />;
    case 'layers':
      return <Layers size={size} color={color} style={style} />;
    case 'file-text':
      return <FileText size={size} color={color} style={style} />;
    case 'building':
      return <Building2 size={size} color={color} style={style} />;
    case 'bell':
      return <Bell size={size} color={color} style={style} />;
    case 'search':
      return <Search size={size} color={color} style={style} />;
    case 'chevron-left':
      return <ChevronLeft size={size} color={color} style={style} />;
    case 'chevron-right':
      return <ChevronRight size={size} color={color} style={style} />;
    case 'trending-up':
      return <TrendingUp size={size} color={color} style={style} />;
    case 'settings':
      return <Settings size={size} color={color} style={style} />;
    case 'plus':
      return <Plus size={size} color={color} style={style} />;
    case 'qr-code':
      return <QrCode size={size} color={color} style={style} />;
    case 'smartphone':
      return <Smartphone size={size} color={color} style={style} />;
    case 'eye':
      return <Eye size={size} color={color} style={style} />;
    case 'filter':
      return <Filter size={size} color={color} style={style} />;
    default:
      return <HelpCircle size={size} color={color} style={style} />;
  }
}
