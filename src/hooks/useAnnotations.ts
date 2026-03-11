'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { v4 as uuidv4 } from 'uuid';
import { PLAnnotation } from '@/types';
import { useToast } from '@/contexts/ToastContext';

export function useAnnotations() {
  const { data: annotations = [], isLoading, mutate } = useSWR<PLAnnotation[]>('/api/annotations');
  const toast = useToast();

  const addAnnotation = useCallback((date: string, label: string) => {
    const annotation: PLAnnotation = { id: uuidv4(), date, label };
    mutate(prev => [...(prev || []), annotation], { revalidate: false });
    fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    })
      .then(res => { if (!res.ok) throw new Error('Save failed'); toast.success('Annotation added'); })
      .catch(err => { console.error('Error adding annotation:', err); toast.error('Failed to add annotation'); });
  }, [mutate, toast]);

  const deleteAnnotation = useCallback((id: string) => {
    mutate(prev => (prev || []).filter(a => a.id !== id), { revalidate: false });
    fetch('/api/annotations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
      .then(res => { if (!res.ok) throw new Error('Delete failed'); toast.success('Annotation removed'); })
      .catch(err => { console.error('Error deleting annotation:', err); toast.error('Failed to remove annotation'); });
  }, [mutate, toast]);

  return { annotations, isLoading, addAnnotation, deleteAnnotation };
}
