import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAppTheme } from '../theme/theme';
import { Icon, IconName } from './Icon';

export interface OrderTrackingTimelineProps {
  status: string;
  createdAt?: string;
}

interface TimelineStage {
  key: string;
  label: string;
  subtitle: string;
  iconName: IconName;
}

const STAGES: TimelineStage[] = [
  { key: 'PENDING', label: 'Order Placed', subtitle: 'Received', iconName: 'clock' },
  { key: 'PROCESSING', label: 'Processing', subtitle: 'Confirmed', iconName: 'package' },
  { key: 'SHIPPED', label: 'Shipped', subtitle: 'On the way', iconName: 'truck' },
  { key: 'DELIVERED', label: 'Delivered', subtitle: 'Arrived', iconName: 'check-circle' },
];

export const OrderTrackingTimeline: React.FC<OrderTrackingTimelineProps> = ({
  status,
  createdAt: _createdAt,
}) => {
  const theme = useAppTheme();
  const upperStatus = (status || 'PENDING').trim().toUpperCase();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.14,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Handle CANCELLED state
  if (upperStatus === 'CANCELLED') {
    return (
      <View
        style={[
          styles.cancelledCard,
          {
            backgroundColor: theme.isDark
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(239, 68, 68, 0.08)',
            borderColor: theme.isDark
              ? 'rgba(239, 68, 68, 0.4)'
              : 'rgba(239, 68, 68, 0.25)',
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel="Order cancelled status notice"
      >
        <View style={styles.cancelledHeaderRow}>
          <Icon name="alert-triangle" size={20} color={theme.colors.danger} strokeWidth={2.2} />
          <View style={styles.cancelledTextContainer}>
            <Text style={[styles.cancelledTitle, { color: theme.colors.danger }]}>
              This order was cancelled
            </Text>
            <Text
              style={[
                styles.cancelledSubtitle,
                { color: theme.isDark ? '#FCA5A5' : '#B91C1C' },
              ]}
            >
              This order is no longer being processed and will not be delivered.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Determine active stage index (0 to 3)
  // Stage 0: PENDING
  // Stage 1: CONFIRMED or PACKED
  // Stage 2: SHIPPED
  // Stage 3: DELIVERED or COMPLETED
  let activeIndex = 0;
  if (upperStatus === 'CONFIRMED' || upperStatus === 'PACKED') {
    activeIndex = 1;
  } else if (upperStatus === 'SHIPPED') {
    activeIndex = 2;
  } else if (upperStatus === 'DELIVERED' || upperStatus === 'COMPLETED') {
    activeIndex = 3;
  }

  // Progress line fill percentage: 0%, 33%, 66%, 100%
  const progressPercent = `${Math.min(100, Math.max(0, (activeIndex / (STAGES.length - 1)) * 100))}%`;

  return (
    <View
      style={[
        styles.timelineCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.borderLight,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Order tracking timeline: Current status is ${upperStatus}`}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          Tracking Timeline
        </Text>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor:
                activeIndex === 3
                  ? theme.colors.successBg
                  : theme.colors.surfaceSubtle,
            },
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              {
                color:
                  activeIndex === 3
                    ? theme.colors.success
                    : theme.colors.primary,
              },
            ]}
          >
            {STAGES[activeIndex]?.label ?? upperStatus}
          </Text>
        </View>
      </View>

      <View style={styles.trackContainer}>
        {/* Background Track Line */}
        <View
          style={[
            styles.progressLineBg,
            { backgroundColor: theme.colors.borderLight },
          ]}
        >
          {/* Active Fill Line */}
          <View
            style={[
              styles.progressLineFill,
              {
                width: progressPercent,
                backgroundColor:
                  activeIndex === 3 ? theme.colors.success : theme.colors.primary,
              },
            ]}
          />
        </View>

        {/* Stage Nodes */}
        <View style={styles.stagesRow}>
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isUpcoming = idx > activeIndex;

            const circleBg = isCompleted
              ? theme.colors.success
              : isCurrent
              ? theme.colors.primary
              : theme.colors.surfaceSubtle;

            const circleBorderColor = isCurrent
              ? theme.colors.primary
              : isUpcoming
              ? theme.colors.borderLight
              : theme.colors.success;

            const iconTextColor = isUpcoming
              ? theme.colors.textMuted
              : isCurrent
              ? theme.colors.primaryText
              : '#FFFFFF';

            return (
              <View key={stage.key} style={styles.stageColumn}>
                {/* Node Circle */}
                <Animated.View
                  style={[
                    styles.nodeCircle,
                    {
                      backgroundColor: circleBg,
                      borderColor: circleBorderColor,
                    },
                    isCurrent && styles.nodeCircleCurrent,
                    isCurrent ? { transform: [{ scale: pulseAnim }] } : undefined,
                  ]}
                >
                  {isCompleted ? (
                    <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} />
                  ) : isCurrent ? (
                    <Icon name={stage.iconName} size={13} color={iconTextColor} strokeWidth={2.2} />
                  ) : (
                    <Text style={[styles.nodeIconText, { color: iconTextColor }]}>
                      {idx + 1}
                    </Text>
                  )}
                </Animated.View>

                {/* Stage Title */}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stageLabel,
                    {
                      color: isCurrent
                        ? theme.colors.text
                        : isCompleted
                        ? theme.colors.success
                        : theme.colors.textMuted,
                      fontWeight: isCurrent ? '800' : isCompleted ? '700' : '500',
                    },
                  ]}
                >
                  {stage.label}
                </Text>

                {/* Subtitle */}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stageSubtitle,
                    {
                      color: isCurrent
                        ? theme.colors.textSecondary
                        : theme.colors.textMuted,
                    },
                  ]}
                >
                  {stage.subtitle}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  timelineCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  trackContainer: {
    position: 'relative',
    paddingVertical: 4,
  },
  progressLineBg: {
    position: 'absolute',
    top: 19,
    left: '12%',
    right: '12%',
    height: 3,
    borderRadius: 2,
    zIndex: 0,
  },
  progressLineFill: {
    height: '100%',
    borderRadius: 2,
  },
  stagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  stageColumn: {
    flex: 1,
    alignItems: 'center',
  },
  nodeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  nodeCircleCurrent: {
    transform: [{ scale: 1.08 }],
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  nodeIconText: {
    fontSize: 13,
    fontWeight: '800',
  },
  stageLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 2,
  },
  stageSubtitle: {
    fontSize: 10,
    textAlign: 'center',
  },
  cancelledCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginVertical: 8,
  },
  cancelledHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelledIcon: {
    fontSize: 22,
  },
  cancelledTextContainer: {
    flex: 1,
  },
  cancelledTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  cancelledSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
