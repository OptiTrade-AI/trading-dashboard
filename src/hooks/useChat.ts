'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Conversation, ChatMessage } from '@/types';

const METADATA_DELIMITER = '\n---METADATA---\n';

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef('');

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat');
      const data = await res.json();
      setIsAvailable(data.available);
      setConversations(data.conversations || []);
    } catch {
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const sendMessage = useCallback(async (message: string, portfolioContext: Record<string, unknown>) => {
    setIsStreaming(true);
    setError(null);
    setStreamingContent('');
    streamingContentRef.current = '';

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Optimistically add user message to active conversation
    const tempUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };

    if (activeConversation) {
      setActiveConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, tempUserMsg],
      } : prev);
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation?.id,
          message,
          portfolioContext,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Chat failed' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        const metaIdx = accumulated.indexOf(METADATA_DELIMITER);
        const visible = metaIdx !== -1 ? accumulated.slice(0, metaIdx) : accumulated;
        setStreamingContent(visible);
        streamingContentRef.current = visible;
      }

      // Parse metadata
      const metaIdx = accumulated.indexOf(METADATA_DELIMITER);
      let finalContent = accumulated;
      let conversationId: string | undefined;

      if (metaIdx !== -1) {
        finalContent = accumulated.slice(0, metaIdx);
        try {
          const meta = JSON.parse(accumulated.slice(metaIdx + METADATA_DELIMITER.length));
          conversationId = meta.conversationId;
        } catch { /* ignore */ }
      }

      // Update active conversation with the complete assistant message
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: finalContent,
        createdAt: new Date().toISOString(),
      };

      if (activeConversation) {
        setActiveConversation(prev => prev ? {
          ...prev,
          messages: [...prev.messages, assistantMsg],
          updatedAt: new Date().toISOString(),
        } : prev);
      } else {
        // New conversation
        const newConv: Conversation = {
          id: conversationId || crypto.randomUUID(),
          title: message.slice(0, 60) + (message.length > 60 ? '...' : ''),
          messages: [tempUserMsg, assistantMsg],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setActiveConversation(newConv);
      }

      setStreamingContent('');
      streamingContentRef.current = '';
      await fetchConversations();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Keep partial content as a message — use ref to avoid stale closure
        const partialContent = streamingContentRef.current;
        if (partialContent) {
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: partialContent,
            createdAt: new Date().toISOString(),
          };

          if (activeConversation) {
            setActiveConversation(prev => prev ? {
              ...prev,
              messages: [...prev.messages, assistantMsg],
              updatedAt: new Date().toISOString(),
            } : prev);
          } else {
            const newConv: Conversation = {
              id: crypto.randomUUID(),
              title: message.slice(0, 60) + (message.length > 60 ? '...' : ''),
              messages: [tempUserMsg, assistantMsg],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setActiveConversation(newConv);
          }
        }
        setStreamingContent('');
        streamingContentRef.current = '';
      } else {
        setError(err instanceof Error ? err.message : 'Chat failed');
        // Remove optimistic user message on error
        if (activeConversation) {
          setActiveConversation(prev => prev ? {
            ...prev,
            messages: prev.messages.filter(m => m.id !== tempUserMsg.id),
          } : prev);
        }
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [activeConversation, fetchConversations]);

  const startNewConversation = useCallback(() => {
    setActiveConversation(null);
    setStreamingContent('');
    setError(null);
  }, []);

  const selectConversation = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConversation(conv);
      setStreamingContent('');
      setError(null);
    }
  }, [conversations]);

  const deleteConversation = useCallback(async (id: string) => {
    await fetch('/api/chat', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (activeConversation?.id === id) {
      setActiveConversation(null);
    }
    await fetchConversations();
  }, [activeConversation, fetchConversations]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await fetch('/api/chat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title }),
    });
    if (activeConversation?.id === id) {
      setActiveConversation(prev => prev ? { ...prev, title } : prev);
    }
    await fetchConversations();
  }, [activeConversation, fetchConversations]);

  return {
    conversations,
    activeConversation,
    streamingContent,
    isStreaming,
    isAvailable,
    isLoading,
    error,
    sendMessage,
    stopStreaming,
    startNewConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
  };
}
