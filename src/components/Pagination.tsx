import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../theme/theme';
import { Icon } from './Icon';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
}

export function getVisiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let start = Math.max(1, currentPage - 1);
  let end = start + 2;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - 2);
  }
  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
}) => {
  const theme = useAppTheme();

  // Global pagination rule: show controls ONLY when records > 10 and totalPages > 1
  if (totalPages <= 1 || (typeof totalItems === 'number' && totalItems <= 10)) {
    return null;
  }

  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= totalPages;
  const visiblePages = getVisiblePages(currentPage, totalPages);

  const handlePrev = () => {
    if (!isPrevDisabled) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (!isNextDisabled) {
      onPageChange(currentPage + 1);
    }
  };

  const prevIconColor = isPrevDisabled ? theme.colors.textMuted : theme.colors.text;
  const nextIconColor = isNextDisabled ? theme.colors.textMuted : theme.colors.text;

  return (
    <View style={styles.container}>
      {/* Page indicator info */}
      <View style={styles.infoRow}>
        <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>
          Page <Text style={[styles.infoHighlight, { color: theme.colors.text }]}>{currentPage}</Text> of{' '}
          <Text style={[styles.infoHighlight, { color: theme.colors.text }]}>{totalPages}</Text>
        </Text>
      </View>

      {/* Button controls */}
      <View style={styles.controlsRow}>
        {/* Previous Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          accessibilityState={{ disabled: isPrevDisabled }}
          disabled={isPrevDisabled}
          style={({ pressed }) => [
            styles.navButton,
            {
              backgroundColor: isPrevDisabled
                ? theme.colors.surfaceSubtle
                : theme.colors.card,
              borderColor: isPrevDisabled
                ? theme.colors.borderLight
                : theme.colors.border,
              opacity: isPrevDisabled ? 0.45 : pressed ? 0.75 : 1,
            },
          ]}
          onPress={handlePrev}
        >
          <View style={styles.navButtonContent}>
            <Icon name="chevron-left" size={16} color={prevIconColor} strokeWidth={2.3} />
            <Text
              style={[
                styles.navButtonText,
                { color: prevIconColor, marginLeft: 2 },
              ]}
            >
              Prev
            </Text>
          </View>
        </Pressable>

        {/* Page Numbers */}
        <View style={styles.numbersGroup}>
          {visiblePages.map((pageNumber) => {
            const isActive = currentPage === pageNumber;
            return (
              <Pressable
                key={pageNumber}
                accessibilityRole="button"
                accessibilityLabel={`Page ${pageNumber}`}
                accessibilityState={{ selected: isActive }}
                style={({ pressed }) => [
                  styles.pageNumberButton,
                  {
                    backgroundColor: isActive
                      ? theme.colors.primary
                      : theme.colors.card,
                    borderColor: isActive
                      ? theme.colors.primary
                      : theme.colors.border,
                    opacity: pressed && !isActive ? 0.75 : 1,
                  },
                ]}
                onPress={() => onPageChange(pageNumber)}
              >
                <Text
                  style={[
                    styles.pageNumberText,
                    {
                      color: isActive
                        ? theme.colors.primaryText
                        : theme.colors.text,
                      fontWeight: isActive ? '800' : '600',
                    },
                  ]}
                >
                  {pageNumber}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Next Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next page"
          accessibilityState={{ disabled: isNextDisabled }}
          disabled={isNextDisabled}
          style={({ pressed }) => [
            styles.navButton,
            {
              backgroundColor: isNextDisabled
                ? theme.colors.surfaceSubtle
                : theme.colors.card,
              borderColor: isNextDisabled
                ? theme.colors.borderLight
                : theme.colors.border,
              opacity: isNextDisabled ? 0.45 : pressed ? 0.75 : 1,
            },
          ]}
          onPress={handleNext}
        >
          <View style={styles.navButtonContent}>
            <Text
              style={[
                styles.navButtonText,
                { color: nextIconColor, marginRight: 2 },
              ]}
            >
              Next
            </Text>
            <Icon name="chevron-right" size={16} color={nextIconColor} strokeWidth={2.3} />
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    marginBottom: 10,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoHighlight: {
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButton: {
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  numbersGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNumberButton: {
    minWidth: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pageNumberText: {
    fontSize: 14,
  },
});
