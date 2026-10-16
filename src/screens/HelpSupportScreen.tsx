import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardAwareScrollViewRef } from '../components/keyboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../config/queryKeys';
import { queryClient } from '../config/queryClient';
import { Icon } from '../components/Icon';
import { AlertDialog, type AlertType } from '../components/dialogs';
import type { FaqCategory, SupportTicket } from '../types/support';
import {
  getFaqs,
  getSupportTickets,
  createSupportTicket,
  getTicketDetails,
  sendTicketMessage,
} from '../services/supportApi';
import { FullPageContentLoader } from '../components/common';
import { withRandomLoadingDuration } from '../utils/loadingUtils';

export interface HelpSupportScreenProps {
  onBack: () => void;
  initialOrderId?: number;
  onNavigateToLogin?: () => void;
}

type SupportTab = 'faqs' | 'contact' | 'tickets';

const TICKET_CATEGORIES = [
  'ORDERS',
  'PAYMENTS',
  'DELIVERY',
  'CANCELLATIONS',
  'RETURNS',
  'ACCOUNT',
  'OTHER',
];

export const HelpSupportScreen: React.FC<HelpSupportScreenProps> = ({
  onBack,
  initialOrderId,
  onNavigateToLogin: _onNavigateToLogin,
}) => {
  const theme = useAppTheme();
  const { user, token } = useAuth();
  const contactScrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const [activeTab, setActiveTab] = useState<SupportTab>('faqs');

  // TanStack Query for FAQs
  const {
    data: faqsData,
    isLoading: isFaqsLoading,
  } = useQuery({
    queryKey: queryKeys.supportFaqs,
    queryFn: async () => {
      return await withRandomLoadingDuration(() => getFaqs());
    },
  });

  const faqs = faqsData || [];
  const faqsLoading = isFaqsLoading && faqs.length === 0;
  const [expandedFaqKey, setExpandedFaqKey] = useState<string | null>(null);

  // Contact form state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('ORDERS');
  const [orderIdInput, setOrderIdInput] = useState(
    initialOrderId ? initialOrderId.toString() : ''
  );
  const [message, setMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // TanStack Query for user tickets
  const {
    data: ticketsData,
    isLoading: isTicketsLoading,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: queryKeys.supportTickets(user?.id),
    queryFn: async () => {
      if (!token) return [];
      return await withRandomLoadingDuration(() => getSupportTickets(token));
    },
    enabled: !!token && activeTab === 'tickets',
  });

  const [localTickets, setLocalTickets] = useState<SupportTicket[] | null>(null);
  const tickets = localTickets || ticketsData || [];
  const ticketsLoading = isTicketsLoading && tickets.length === 0;

  // Ticket thread detail modal state
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!token) return;
    try {
      const res = await refetchTickets();
      if (res.data) {
        setLocalTickets(res.data);
      }
    } catch (err: any) {
      console.warn('Could not load tickets:', err);
    }
  }, [token, refetchTickets]);

  const [alertDialog, setAlertDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
    buttonText?: string;
    onClose?: () => void;
  } | null>(null);

  const handleSubmitTicket = async () => {
    if (!token) {
      setAlertDialog({
        visible: true,
        title: 'Sign In Required',
        message: 'Please sign in to submit a support ticket.',
        type: 'info',
      });
      return;
    }

    if (!subject.trim()) {
      setAlertDialog({
        visible: true,
        title: 'Validation Error',
        message: 'Please enter a ticket subject.',
        type: 'warning',
      });
      return;
    }
    if (!message.trim()) {
      setAlertDialog({
        visible: true,
        title: 'Validation Error',
        message: 'Please describe your query in detail.',
        type: 'warning',
      });
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const parsedOrder = orderIdInput.trim() ? Number(orderIdInput.trim()) : null;
      const created = await createSupportTicket(
        {
          subject: subject.trim(),
          category,
          message: message.trim(),
          orderId: Number.isFinite(parsedOrder) ? parsedOrder : null,
        },
        token
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.supportTickets(user?.id) });
      setAlertDialog({
        visible: true,
        title: 'Ticket Created',
        message: `Your ticket #${created.ticketNumber} has been received. Our team will assist you shortly.`,
        type: 'success',
        buttonText: 'View Tickets',
        onClose: () => {
          setSubject('');
          setMessage('');
          setActiveTab('tickets');
        },
      });
    } catch (err: any) {
      setAlertDialog({
        visible: true,
        title: 'Error',
        message: err?.message || 'Could not submit support ticket.',
        type: 'error',
      });
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleOpenTicketThread = async (ticketId: number) => {
    if (!token) return;
    setDetailLoading(true);
    setIsDetailModalVisible(true);
    try {
      const ticket = await getTicketDetails(ticketId, token);
      setActiveTicket(ticket);
    } catch (err: any) {
      setAlertDialog({
        visible: true,
        title: 'Error',
        message: err?.message || 'Could not load ticket conversation.',
        type: 'error',
      });
      setIsDetailModalVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!token || !activeTicket || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      await sendTicketMessage(activeTicket.id, replyText.trim(), token);
      setReplyText('');
      // Reload ticket thread
      const updated = await getTicketDetails(activeTicket.id, token);
      setActiveTicket(updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.supportTickets(user?.id) });
      loadTickets();
    } catch (err: any) {
      setAlertDialog({
        visible: true,
        title: 'Error',
        message: err?.message || 'Could not send message.',
        type: 'error',
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OPEN':
        return theme.colors.primary;
      case 'IN_PROGRESS':
        return '#f59e0b';
      case 'RESOLVED':
        return '#10b981';
      case 'CLOSED':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Help & Customer Support
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={() => setActiveTab('faqs')}
          style={[
            styles.tabItem,
            activeTab === 'faqs' && [
              styles.activeTabItem,
              { borderBottomColor: theme.colors.primary },
            ],
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'faqs'
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                fontWeight: activeTab === 'faqs' ? '700' : '500',
              },
            ]}
          >
            FAQs
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('contact')}
          style={[
            styles.tabItem,
            activeTab === 'contact' && [
              styles.activeTabItem,
              { borderBottomColor: theme.colors.primary },
            ],
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'contact'
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                fontWeight: activeTab === 'contact' ? '700' : '500',
              },
            ]}
          >
            Contact Us
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('tickets')}
          style={[
            styles.tabItem,
            activeTab === 'tickets' && [
              styles.activeTabItem,
              { borderBottomColor: theme.colors.primary },
            ],
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'tickets'
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                fontWeight: activeTab === 'tickets' ? '700' : '500',
              },
            ]}
          >
            My Tickets
          </Text>
        </Pressable>
      </View>

      {/* Tab 1: FAQs */}
      {activeTab === 'faqs' &&
        (faqsLoading ? (
          <FullPageContentLoader message="Loading help & FAQs..." />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {faqs.map((cat, catIdx) => (
              <View key={cat.category || `faq-cat-${catIdx}`} style={styles.faqCategorySection}>
                <Text style={[styles.faqCategoryTitle, { color: theme.colors.text }]}>
                  {cat.category}
                </Text>

                {cat.items.map((item, itemIdx) => {
                  const key = `${catIdx}-${itemIdx}`;
                  const isExpanded = expandedFaqKey === key;

                  return (
                    <Pressable
                      key={item.q || key || `faq-item-${itemIdx}`}
                      onPress={() => setExpandedFaqKey(isExpanded ? null : key)}
                      style={[
                        styles.faqCard,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <View style={styles.faqHeaderRow}>
                        <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>
                          {item.q}
                        </Text>
                        <Icon
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={theme.colors.textSecondary}
                        />
                      </View>

                      {isExpanded && (
                        <Text
                          style={[
                            styles.faqAnswer,
                            { color: theme.colors.textSecondary, borderTopColor: theme.colors.border },
                          ]}
                        >
                          {item.a}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {/* Quick Contact Banner */}
            <View
              style={[
                styles.quickContactCard,
                { backgroundColor: theme.colors.surfaceSubtle },
              ]}
            >
              <Icon name="message" size={24} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.quickContactTitle, { color: theme.colors.text }]}>
                  Still need help?
                </Text>
                <Text style={[styles.quickContactSub, { color: theme.colors.textSecondary }]}>
                  Submit a support ticket and our customer care team will respond within 24 hours.
                </Text>
              </View>
              <Pressable
                onPress={() => setActiveTab('contact')}
                style={[styles.quickContactBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={[styles.quickContactBtnText, { color: theme.colors.primaryText }]}>Ask Us</Text>
              </Pressable>
            </View>
          </ScrollView>
        ))}

      {/* Tab 2: Contact Form */}
      {activeTab === 'contact' && (
        <KeyboardAwareScrollView
          ref={contactScrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          extraScrollHeight={60}
        >
          <View
            style={[
              styles.formCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.formHeaderTitle, { color: theme.colors.text }]}>
              Create a Support Request
            </Text>
            <Text style={[styles.formHeaderSubtitle, { color: theme.colors.textSecondary }]}>
              Please describe your problem or question in detail.
            </Text>

            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              Category *
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {TICKET_CATEGORIES.map((cat, catIdx) => {
                const isSelected = category === cat;
                return (
                  <Pressable
                    key={cat || `ticket-cat-${catIdx}`}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.chipSelectedBg
                          : theme.colors.chipUnselectedBg,
                        borderColor: isSelected
                          ? theme.colors.chipSelectedBg
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        {
                          color: isSelected
                            ? theme.colors.chipSelectedText
                            : theme.colors.chipUnselectedText,
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              Order ID (Optional)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              placeholder="e.g. 102"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={orderIdInput}
              onChangeText={setOrderIdInput}
              onFocus={() => contactScrollRef.current?.scrollToInput(80)}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              Subject *
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              placeholder="e.g. Inquiring about delivery delay"
              placeholderTextColor={theme.colors.textMuted}
              value={subject}
              onChangeText={setSubject}
              onFocus={() => contactScrollRef.current?.scrollToInput(160)}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              Detailed Message *
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              placeholder="Provide as much context as possible..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
              onFocus={() => contactScrollRef.current?.scrollToInput(240)}
            />

            <Pressable
              onPress={handleSubmitTicket}
              style={[
                styles.submitBtn,
                { backgroundColor: theme.colors.primary, opacity: isSubmittingTicket ? 0.7 : 1 },
              ]}
              disabled={isSubmittingTicket}
            >
              {isSubmittingTicket ? (
                <ActivityIndicator size="small" color={theme.colors.primaryText} />
              ) : (
                <Text style={[styles.submitBtnText, { color: theme.colors.primaryText }]}>Submit Support Ticket</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAwareScrollView>
      )}

      {/* Tab 3: My Tickets */}
      {activeTab === 'tickets' && (
        <View style={styles.ticketsContainer}>
          {ticketsLoading ? (
            <FullPageContentLoader message="Loading your support tickets..." />
          ) : tickets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.surfaceSubtle }]}>
                <Icon name="message" size={40} color={theme.colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No support tickets
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                You haven't opened any support requests yet. If you ever have a question or issue, submit a ticket from the Contact Us tab.
              </Text>
              <Pressable
                onPress={() => setActiveTab('contact')}
                style={[styles.createFirstBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={[styles.createFirstBtnText, { color: theme.colors.primaryText }]}>Create New Ticket</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={tickets}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleOpenTicketThread(item.id)}
                  style={[
                    styles.ticketCard,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  ]}
                >
                  <View style={styles.ticketCardHeader}>
                    <Text style={[styles.ticketNum, { color: theme.colors.textSecondary }]}>
                      #{item.ticketNumber}
                    </Text>
                    <View
                      style={[
                        styles.ticketStatusBadge,
                        { backgroundColor: `${getStatusColor(item.status)}20` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ticketStatusText,
                          { color: getStatusColor(item.status) },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.ticketSubject, { color: theme.colors.text }]}>
                    {item.subject}
                  </Text>

                  {item.lastMessage && (
                    <Text
                      style={[styles.ticketLastMsg, { color: theme.colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {item.lastMessage}
                    </Text>
                  )}

                  <View style={[styles.ticketFooter, { borderTopColor: theme.colors.border }]}>
                    <Text style={[styles.ticketDate, { color: theme.colors.textMuted }]}>
                      Updated {formatDate(item.updatedAt)}
                    </Text>
                    <Text style={[styles.ticketReplyCount, { color: theme.colors.primary }]}>
                      💬 {item.messagesCount} message{item.messagesCount === 1 ? '' : 's'} →
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      )}

      {/* Ticket Conversation Thread Modal */}
      <Modal
        visible={isDetailModalVisible}
        animationType="slide"
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: theme.colors.background }]}
          edges={['top', 'left', 'right', 'bottom']}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Thread Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <Pressable
                onPress={() => setIsDetailModalVisible(false)}
                style={styles.backBtn}
              >
                <Icon name="arrow-left" size={22} color={theme.colors.text} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.threadTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {activeTicket ? activeTicket.subject : 'Ticket Thread'}
                </Text>
                <Text style={[styles.threadSubtitle, { color: theme.colors.textSecondary }]}>
                  {activeTicket ? `#${activeTicket.ticketNumber} • ${activeTicket.status}` : ''}
                </Text>
              </View>
            </View>

            {detailLoading || !activeTicket ? (
              <FullPageContentLoader message="Loading ticket thread..." />
            ) : (
              <View style={{ flex: 1 }}>
                {/* Message List */}
                <FlatList
                  data={activeTicket.messages || []}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={styles.messagesList}
                  renderItem={({ item }) => {
                    const isUser = item.senderType === 'USER';
                    return (
                      <View
                        style={[
                          styles.messageRow,
                          isUser ? styles.messageRowUser : styles.messageRowAgent,
                        ]}
                      >
                        <View
                          style={[
                            styles.messageBubble,
                            isUser
                              ? [styles.bubbleUser, { backgroundColor: theme.colors.primary }]
                              : [styles.bubbleAgent, { backgroundColor: theme.colors.surfaceSubtle }],
                          ]}
                        >
                          <Text
                            style={[
                              styles.senderLabel,
                              { color: isUser ? theme.colors.primaryText : theme.colors.textSecondary },
                            ]}
                          >
                            {item.senderName || (isUser ? 'You' : 'ShopEasy Support')}
                          </Text>
                          <Text
                            style={[
                              styles.messageBody,
                              { color: isUser ? theme.colors.primaryText : theme.colors.text },
                            ]}
                          >
                            {item.message}
                          </Text>
                          <Text
                            style={[
                              styles.msgTime,
                              {
                                color: isUser
                                  ? (theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)')
                                  : theme.colors.textMuted,
                              },
                            ]}
                          >
                            {formatDate(item.createdAt)}
                          </Text>
                        </View>
                      </View>
                    );
                  }}
                />

                {/* Reply Box */}
                <View
                  style={[
                    styles.replyContainer,
                    {
                      backgroundColor: theme.colors.card,
                      borderTopColor: theme.colors.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.replyInput,
                      {
                        backgroundColor: theme.colors.surfaceSubtle,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    placeholder="Type your reply..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                  />
                  <Pressable
                    onPress={handleSendReply}
                    style={[
                      styles.sendBtn,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: isSendingReply || !replyText.trim() ? 0.6 : 1,
                      },
                    ]}
                    disabled={isSendingReply || !replyText.trim()}
                  >
                    {isSendingReply ? (
                      <ActivityIndicator size="small" color={theme.colors.primaryText} />
                    ) : (
                      <Icon name="send" size={18} color={theme.colors.primaryText} fill={theme.colors.primaryText} />
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modern Alert Dialog */}
      <AlertDialog
        visible={alertDialog?.visible || false}
        title={alertDialog?.title || ''}
        message={alertDialog?.message || ''}
        type={alertDialog?.type || 'info'}
        buttonText={alertDialog?.buttonText || 'OK'}
        onClose={() => {
          const cb = alertDialog?.onClose;
          setAlertDialog(null);
          cb?.();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {},
  tabText: {
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  faqCategorySection: {
    marginBottom: 12,
  },
  faqCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  faqCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  faqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  faqAnswer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  quickContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
  },
  quickContactTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  quickContactSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  quickContactBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickContactBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  formCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  formHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  formHeaderSubtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 100,
  },
  submitBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  ticketsContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  ticketCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketNum: {
    fontSize: 12,
    fontWeight: '600',
  },
  ticketStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ticketStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  ticketLastMsg: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  ticketDate: {
    fontSize: 11,
  },
  ticketReplyCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  createFirstBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  createFirstBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  threadTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  threadSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAgent: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 14,
  },
  bubbleUser: {
    borderBottomRightRadius: 2,
  },
  bubbleAgent: {
    borderBottomLeftRadius: 2,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
