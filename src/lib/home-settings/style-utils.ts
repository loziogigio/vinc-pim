import type { CSSProperties } from 'react';
import type { MediaCardStyle as BaseStyle } from '@/lib/types/home-settings';

export type MediaCardStyle = BaseStyle;

const borderRadiusMap: Record<MediaCardStyle['borderRadius'], string> = {
  none: '0',
  sm: '0.125rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  full: '9999px'
};

const shadowMap: Record<Exclude<MediaCardStyle['shadowSize'], 'none'>, string> = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)'
};

const hoverShadowMap: Record<Exclude<MediaCardStyle['hoverShadowSize'], undefined>, string> = {
  sm: shadowMap.sm,
  md: shadowMap.md,
  lg: shadowMap.lg,
  xl: shadowMap.xl,
  '2xl': shadowMap['2xl']
};

export function computeMediaCardStyle(style: MediaCardStyle): CSSProperties {
  const borderWidth = style.borderStyle === 'none' || style.borderWidth <= 0 ? 0 : style.borderWidth;

  const result: CSSProperties = {
    borderWidth: `${borderWidth}px`,
    borderStyle: style.borderStyle,
    borderColor: style.borderStyle === 'none' ? 'transparent' : style.borderColor,
    borderRadius: borderRadiusMap[style.borderRadius],
    backgroundColor: style.backgroundColor,
    transition: 'all 0.2s ease'
  };

  // Only add boxShadow if there's a non-none shadow, otherwise omit it
  // so hover effects can work via CSS classes
  if (style.shadowSize !== 'none') {
    result.boxShadow = shadowMap[style.shadowSize as Exclude<MediaCardStyle['shadowSize'], 'none'>];
  }

  return result;
}

export function computeMediaHoverDeclarations(style: MediaCardStyle): string[] {
  const declarations: string[] = [];

  switch (style.hoverEffect) {
    case 'lift':
      declarations.push('transform: translateY(-4px);');
      break;
    case 'shadow':
      declarations.push(`box-shadow: ${hoverShadowMap[style.hoverShadowSize || 'lg']};`);
      break;
    case 'scale':
      declarations.push(`transform: scale(${style.hoverScale || 1.02});`);
      break;
    case 'border':
      declarations.push(`border-color: ${style.borderColor};`);
      declarations.push('filter: brightness(0.95);');
      break;
    case 'glow':
      declarations.push(`box-shadow: 0 0 25px ${style.shadowColor};`);
      break;
    default:
      break;
  }

  if (style.hoverBackgroundColor && style.hoverEffect !== 'shadow') {
    declarations.push(`background-color: ${style.hoverBackgroundColor};`);
  }

  return declarations;
}

export { borderRadiusMap, shadowMap, hoverShadowMap };
