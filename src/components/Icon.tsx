import React from 'react';
import { StyleProp, ViewStyle, View } from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  Line,
  Polyline,
  Polygon,
  G,
} from 'react-native-svg';

export type IconName =
  | 'home'
  | 'products'
  | 'bag'
  | 'shopping-bag'
  | 'categories'
  | 'grid'
  | 'layout-grid'
  | 'orders'
  | 'package'
  | 'box'
  | 'search'
  | 'heart'
  | 'heart-filled'
  | 'cart'
  | 'shopping-cart'
  | 'user'
  | 'profile'
  | 'account'
  | 'star'
  | 'star-filled'
  | 'star-half'
  | 'close'
  | 'x'
  | 'check'
  | 'check-circle'
  | 'arrow-left'
  | 'back'
  | 'chevron-right'
  | 'next'
  | 'chevron-left'
  | 'prev'
  | 'chevron-down'
  | 'chevron-up'
  | 'arrow-up-down'
  | 'sort'
  | 'trash'
  | 'delete'
  | 'plus'
  | 'minus'
  | 'truck'
  | 'delivery'
  | 'shield'
  | 'shield-check'
  | 'refresh'
  | 'logout'
  | 'moon'
  | 'sun'
  | 'tag'
  | 'discount'
  | 'credit-card'
  | 'payment'
  | 'map-pin'
  | 'location'
  | 'info'
  | 'alert'
  | 'alert-circle'
  | 'alert-triangle'
  | 'warning'
  | 'sparkles'
  | 'gem'
  | 'shirt'
  | 'laptop'
  | 'book'
  | 'shoe'
  | 'flower'
  | 'utensils'
  | 'activity'
  | 'gamepad'
  | 'edit'
  | 'pencil'
  | 'clock'
  | 'lock'
  | 'mail'
  | 'phone'
  | 'eye'
  | 'eye-off'
  | string;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = '#111827',
  strokeWidth = 2,
  fill,
  style,
  accessibilityLabel,
}) => {
  const norm = (name || '').toLowerCase().trim();

  // Helper to render standard SVG canvas
  const renderSvg = (content: React.ReactNode, viewBox = '0 0 24 24') => (
    <View
      style={style}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || name}
    >
      <Svg
        key={`${norm}-${color}-${fill || 'none'}`}
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {content}
      </Svg>
    </View>
  );

  switch (norm) {
    case 'home':
      return renderSvg(
        <G>
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Polyline points="9 22 9 12 15 12 15 22" />
        </G>
      );

    case 'search':
      return renderSvg(
        <G>
          <Circle cx="11" cy="11" r="8" />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" />
        </G>
      );

    case 'heart':
      return renderSvg(
        <Path
          key="heart-outline"
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          fill={fill || 'none'}
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );

    case 'heart-filled':
      return renderSvg(
        <Path
          key="heart-filled"
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          fill={fill || color}
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );

    case 'cart':
    case 'shopping-cart':
      return renderSvg(
        <G>
          <Circle cx="9" cy="21" r="1" />
          <Circle cx="20" cy="21" r="1" />
          <Path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </G>
      );

    case 'products':
    case 'bag':
    case 'shopping-bag':
    case 'bags':
      return renderSvg(
        <G>
          <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <Line x1="3" y1="6" x2="21" y2="6" />
          <Path d="M16 10a4 4 0 0 1-8 0" />
        </G>
      );

    case 'categories':
    case 'grid':
    case 'layout-grid':
      return renderSvg(
        <G>
          <Rect x="3" y="3" width="7" height="7" rx="1" />
          <Rect x="14" y="3" width="7" height="7" rx="1" />
          <Rect x="14" y="14" width="7" height="7" rx="1" />
          <Rect x="3" y="14" width="7" height="7" rx="1" />
        </G>
      );

    case 'orders':
    case 'package':
    case 'box':
      return renderSvg(
        <G>
          <Path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <Polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <Line x1="12" y1="22.08" x2="12" y2="12" />
        </G>
      );

    case 'user':
    case 'profile':
    case 'account':
      return renderSvg(
        <G>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle cx="12" cy="7" r="4" />
        </G>
      );

    case 'star':
      return renderSvg(
        <Polygon
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          fill={fill || 'none'}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      );

    case 'star-filled':
      return renderSvg(
        <Polygon
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          fill={fill || color}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      );

    case 'star-half':
      return renderSvg(
        <G>
          <Polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            fill="none"
            stroke={color}
          />
          <Path
            d="M12 2v15.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={fill || color}
            stroke={color}
          />
        </G>
      );

    case 'close':
    case 'x':
      return renderSvg(
        <G>
          <Line x1="18" y1="6" x2="6" y2="18" />
          <Line x1="6" y1="6" x2="18" y2="18" />
        </G>
      );

    case 'check':
      return renderSvg(<Polyline points="20 6 9 17 4 12" />);

    case 'check-circle':
      return renderSvg(
        <G>
          <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <Polyline points="22 4 12 14.01 9 11.01" />
        </G>
      );

    case 'arrow-left':
    case 'back':
      return renderSvg(
        <G>
          <Line x1="19" y1="12" x2="5" y2="12" />
          <Polyline points="12 19 5 12 12 5" />
        </G>
      );

    case 'chevron-right':
    case 'next':
      return renderSvg(<Polyline points="9 18 15 12 9 6" />);

    case 'chevron-left':
    case 'prev':
      return renderSvg(<Polyline points="15 18 9 12 15 6" />);

    case 'chevron-down':
      return renderSvg(<Polyline points="6 9 12 15 18 9" />);

    case 'chevron-up':
      return renderSvg(<Polyline points="18 15 12 9 6 15" />);

    case 'arrow-up-down':
    case 'sort':
      return renderSvg(
        <G>
          <Path d="m21 16-4 4-4-4" />
          <Path d="M17 20V4" />
          <Path d="m3 8 4-4 4 4" />
          <Path d="M7 4v16" />
        </G>
      );

    case 'trash':
    case 'delete':
      return renderSvg(
        <G>
          <Path d="M3 6h18" />
          <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <Line x1="10" y1="11" x2="10" y2="17" />
          <Line x1="14" y1="11" x2="14" y2="17" />
        </G>
      );

    case 'plus':
      return renderSvg(
        <G>
          <Line x1="12" y1="5" x2="12" y2="19" />
          <Line x1="5" y1="12" x2="19" y2="12" />
        </G>
      );

    case 'minus':
      return renderSvg(<Line x1="5" y1="12" x2="19" y2="12" />);

    case 'truck':
    case 'delivery':
      return renderSvg(
        <G>
          <Rect x="1" y="3" width="15" height="13" rx="2" />
          <Polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <Circle cx="5.5" cy="18.5" r="2.5" />
          <Circle cx="18.5" cy="18.5" r="2.5" />
        </G>
      );

    case 'shield':
    case 'shield-check':
      return renderSvg(
        <G>
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <Polyline points="9 12 11 14 15 10" />
        </G>
      );

    case 'refresh':
      return renderSvg(
        <G>
          <Path d="M21 2v6h-6" />
          <Path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <Path d="M3 22v-6h6" />
          <Path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </G>
      );

    case 'logout':
      return renderSvg(
        <G>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Polyline points="16 17 21 12 16 7" />
          <Line x1="21" y1="12" x2="9" y2="12" />
        </G>
      );

    case 'moon':
      return renderSvg(<Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />);

    case 'sun':
      return renderSvg(
        <G>
          <Circle cx="12" cy="12" r="4" />
          <Line x1="12" y1="2" x2="12" y2="4" />
          <Line x1="12" y1="20" x2="12" y2="22" />
          <Line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <Line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          <Line x1="2" y1="12" x2="4" y2="12" />
          <Line x1="20" y1="12" x2="22" y2="12" />
          <Line x1="6.34" y1="17.66" x2="4.93" y2="19.07" />
          <Line x1="19.07" y1="4.93" x2="17.66" y2="6.34" />
        </G>
      );

    case 'tag':
    case 'discount':
      return renderSvg(
        <G>
          <Path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <Line x1="7" y1="7" x2="7.01" y2="7" strokeWidth={strokeWidth + 1} />
        </G>
      );

    case 'credit-card':
    case 'payment':
      return renderSvg(
        <G>
          <Rect x="1" y="4" width="22" height="16" rx="2" />
          <Line x1="1" y1="10" x2="23" y2="10" />
        </G>
      );

    case 'map-pin':
    case 'location':
      return renderSvg(
        <G>
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <Circle cx="12" cy="10" r="3" />
        </G>
      );

    case 'info':
      return renderSvg(
        <G>
          <Circle cx="12" cy="12" r="10" />
          <Line x1="12" y1="16" x2="12" y2="12" />
          <Line x1="12" y1="8" x2="12.01" y2="8" strokeWidth={strokeWidth + 1} />
        </G>
      );

    case 'alert':
    case 'alert-circle':
      return renderSvg(
        <G>
          <Circle cx="12" cy="12" r="10" />
          <Line x1="12" y1="8" x2="12" y2="12" />
          <Line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={strokeWidth + 1} />
        </G>
      );

    case 'alert-triangle':
    case 'warning':
      return renderSvg(
        <G>
          <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <Line x1="12" y1="9" x2="12" y2="13" />
          <Line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={strokeWidth + 1} />
        </G>
      );

    case 'sparkles':
    case 'all':
      return renderSvg(
        <G>
          <Path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </G>
      );

    case 'gem':
    case 'accessories':
      return renderSvg(
        <G>
          <Path d="M6 3h12l4 6-10 13L2 9Z" />
          <Path d="M11 3 8 9l4 13 4-13-3-6" />
          <Line x1="2" y1="9" x2="22" y2="9" />
        </G>
      );

    case 'shirt':
    case 'clothing':
    case 'fashion':
      return renderSvg(
        <Path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
      );

    case 'laptop':
    case 'electronics':
    case 'mobiles':
      return renderSvg(
        <G>
          <Rect x="2" y="3" width="20" height="14" rx="2" />
          <Line x1="8" y1="21" x2="16" y2="21" />
          <Line x1="12" y1="17" x2="12" y2="21" />
        </G>
      );

    case 'book':
    case 'books':
      return renderSvg(
        <G>
          <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <Line x1="6" y1="2" x2="6" y2="22" />
        </G>
      );

    case 'shoe':
    case 'footwear':
      return renderSvg(
        <G>
          <Path d="M4 16v-2.38C4 11.5 5.5 9.5 7.5 9.5H11l2 2h4.5a3.5 3.5 0 0 1 3.5 3.5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
          <Line x1="4" y1="17" x2="21" y2="17" />
        </G>
      );

    case 'flower':
    case 'beauty':
      return renderSvg(
        <G>
          <Circle cx="12" cy="12" r="3" />
          <Path d="M12 2a4 4 0 0 0-4 4 4 4 0 0 0 8 0 4 4 0 0 0-4-4Z" />
          <Path d="M12 22a4 4 0 0 0 4-4 4 4 0 0 0-8 0 4 4 0 0 0 4 4Z" />
          <Path d="M2 12a4 4 0 0 0 4 4 4 4 0 0 0 0-8 4 4 0 0 0-4 4Z" />
          <Path d="M22 12a4 4 0 0 0-4-4 4 4 0 0 0 0 8 4 4 0 0 0 4-4Z" />
        </G>
      );

    case 'utensils':
    case 'home & kitchen':
      return renderSvg(
        <G>
          <Path d="M18 2v20" />
          <Path d="M21 15V2v0a3 3 0 0 0-3 3v6a4 4 0 0 0 3 4Z" />
          <Path d="M6 2v20" />
          <Path d="M9 2v6a3 3 0 0 1-6 0V2" />
        </G>
      );

    case 'activity':
    case 'sports':
      return renderSvg(<Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />);

    case 'gamepad':
    case 'toys':
      return renderSvg(
        <G>
          <Rect x="2" y="6" width="20" height="12" rx="2" />
          <Line x1="6" y1="12" x2="10" y2="12" />
          <Line x1="8" y1="10" x2="8" y2="14" />
          <Line x1="15" y1="13" x2="15.01" y2="13" strokeWidth={strokeWidth + 1} />
          <Line x1="18" y1="11" x2="18.01" y2="11" strokeWidth={strokeWidth + 1} />
        </G>
      );

    case 'edit':
    case 'pencil':
      return renderSvg(
        <Path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      );

    case 'clock':
      return renderSvg(
        <G>
          <Circle cx="12" cy="12" r="10" />
          <Polyline points="12 6 12 12 16 14" />
        </G>
      );

    case 'lock':
      return renderSvg(
        <G>
          <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </G>
      );

    case 'mail':
      return renderSvg(
        <G>
          <Rect x="2" y="4" width="20" height="16" rx="2" />
          <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </G>
      );

    case 'phone':
      return renderSvg(
        <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      );

    case 'eye':
      return renderSvg(
        <G>
          <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <Circle cx="12" cy="12" r="3" />
        </G>
      );

    case 'zap':
    case 'bolt':
      return renderSvg(
        <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={fill} />
      );

    case 'eye-off':
      return renderSvg(
        <G>
          <Path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <Path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <Path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <Line x1="2" y1="2" x2="22" y2="22" />
        </G>
      );

    case 'bell':
    case 'notification':
      return renderSvg(
        <G>
          <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </G>
      );

    case 'help':
    case 'help-circle':
      return renderSvg(
        <G>
          <Circle cx="12" cy="12" r="10" />
          <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <Line x1="12" y1="17" x2="12.01" y2="17" />
        </G>
      );

    case 'message':
    case 'message-square':
    case 'chat':
      return renderSvg(
        <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      );

    case 'send':
      return renderSvg(
        <G>
          <Line x1="22" y1="2" x2="11" y2="13" />
          <Polygon points="22 2 15 22 11 13 2 9 22 2" fill={fill} />
        </G>
      );

    case 'bar-chart':
    case 'analytics':
    case 'chart':
      return renderSvg(
        <G>
          <Line x1="18" y1="20" x2="18" y2="10" />
          <Line x1="12" y1="20" x2="12" y2="4" />
          <Line x1="6" y1="20" x2="6" y2="14" />
        </G>
      );

    case 'users':
      return renderSvg(
        <G>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle cx="9" cy="7" r="4" />
          <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </G>
      );

    case 'filter':
      return renderSvg(
        <Polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      );

    case 'percent':
      return renderSvg(
        <G>
          <Line x1="19" y1="5" x2="5" y2="19" />
          <Circle cx="6.5" cy="6.5" r="2.5" />
          <Circle cx="17.5" cy="17.5" r="2.5" />
        </G>
      );

    case 'upi':
      return renderSvg(
        <G>
          <Path d="M4 4h7l-3 7h5l-6 9 2-6H4l2-10z" fill={fill || 'none'} />
        </G>
      );

    case 'download':
      return renderSvg(
        <G>
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <Polyline points="7 10 12 15 17 10" />
          <Line x1="12" y1="15" x2="12" y2="3" />
        </G>
      );

    case 'file-text':
      return renderSvg(
        <G>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <Polyline points="14 2 14 8 20 8" />
          <Line x1="16" y1="13" x2="8" y2="13" />
          <Line x1="16" y1="17" x2="8" y2="17" />
          <Polyline points="10 9 9 9 8 9" />
        </G>
      );

    default:
      // Fallback: A neat info dot
      return renderSvg(
        <G>
          <Circle cx="12" cy="12" r="10" />
          <Circle cx="12" cy="12" r="1" fill={color} />
        </G>
      );
  }
};
