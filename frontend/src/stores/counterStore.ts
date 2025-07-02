import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ApiService } from '../services/api.service';
import { WebSocketService } from '../services/websocket.service';

interface CounterState {
  value: number;
  targetValue: number;
  isLoading: boolean;
  error: string | null;
  isAnimating: boolean;
  lastOperation: 'increment' | 'decrement' | null;
  operationCount: number;
  hasInitialized: boolean;
  increment: () => Promise<void>;
  decrement: () => Promise<void>;
  fetchValue: () => Promise<void>;
  setTargetValue: (value: number) => void;
  setAnimating: (animating: boolean) => void;
  setValue: (value: number) => void;
  reset: () => void;
}

const apiService = new ApiService();
const wsService = new WebSocketService();

export const useCounterStore = create<CounterState>()(
  subscribeWithSelector((set, get) => ({
    value: 0,
    targetValue: 0,
    isLoading: false,
    error: null,
    isAnimating: false,
    lastOperation: null,
    operationCount: 0,
    hasInitialized: false,

    increment: async () => {
      const { isLoading, isAnimating, value } = get();
      if (isLoading || isAnimating) return;

      // Optimistic update
      const optimisticValue = Math.min(value + 1, 1_000_000_000);
      set({
        targetValue: optimisticValue,
        isLoading: true,
        error: null,
        lastOperation: 'increment',
      });

      try {
        const result = await apiService.increment();
        console.log('Increment result:', result);
        set({
          targetValue: result.value!,
          operationCount: get().operationCount + 1,
        });
      } catch (error: any) {
        console.error('Increment error:', error);
        // Revert optimistic update on error
        set({
          targetValue: value,
          error: error.message,
        });
      } finally {
        set({ isLoading: false });
      }
    },

    decrement: async () => {
      const { isLoading, isAnimating, value } = get();
      if (isLoading || isAnimating || value === 0) return;

      // Optimistic update
      const optimisticValue = Math.max(value - 1, 0);
      set({
        targetValue: optimisticValue,
        isLoading: true,
        error: null,
        lastOperation: 'decrement',
      });

      try {
        const result = await apiService.decrement();
        set({
          targetValue: result.value!,
          operationCount: get().operationCount + 1,
        });
      } catch (error: any) {
        // Revert optimistic update on error
        set({
          targetValue: value,
          error: error.message,
        });
      } finally {
        set({ isLoading: false });
      }
    },

    fetchValue: async () => {
      const { isAnimating } = get();
      
      // Don't fetch if we're already animating
      if (isAnimating) {
        console.log('Skipping fetch - animation in progress');
        return;
      }
      
      set({ error: null });
      try {
        const result = await apiService.getValue();
        console.log('Fetched value:', result);
        
        // Always animate from current value to fetched value
        const currentValue = get().value;
        
        if (result.value! !== currentValue) {
          // Always animate to the new value
          set({
            targetValue: result.value!,
            operationCount: 0,
            hasInitialized: true,
          });
        } else {
          // Same value, just update state
          set({
            value: result.value!,
            targetValue: result.value!,
            operationCount: 0,
            hasInitialized: true,
          });
        }
      } catch (error: any) {
        console.error('Fetch value error:', error);
        set({ error: error.message });
      }
    },

    setTargetValue: (value: number) => set({ targetValue: value }),
    setAnimating: (animating: boolean) => set({ isAnimating: animating }),
    setValue: (value: number) => set({ value }),
    reset: () => set({ error: null, isLoading: false }),
  }))
);

// Initialize WebSocket connection
wsService.connect();

// Handle WebSocket updates
wsService.onUpdate((data) => {
  const state = useCounterStore.getState();

  // Only update if the change wasn't initiated by this client
  if (data.clientId !== apiService.getClientId()) {
    console.log('Received update from another client:', data);
    console.log('[WS] Incoming value:', data.value, 'Current targetValue:', state.targetValue);
    state.setTargetValue(data.value);
  }
});

let animationFrame: number | null = null;

// Subscribe to targetValue changes to trigger animation
useCounterStore.subscribe(
  (state) => state.targetValue,
  (targetValue) => {
    const { value, setAnimating, setValue } = useCounterStore.getState();
    const delta = Math.abs(targetValue - value);

    console.log('Target value changed:', targetValue, 'Current value:', value, 'Delta:', delta);

    // Trigger animation for changes greater than 1
    if (delta > 1) {
      setAnimating(true);
    }

    const step = () => {
      const { value, targetValue } = useCounterStore.getState();
      if (value === targetValue) {
        useCounterStore.getState().setAnimating(false);
        return;
      }

      const direction = targetValue > value ? 1 : -1;
      useCounterStore.getState().setValue(value + direction);
    };
    // else if (delta === 1) {
    //   // Direct update for single increments
    //   setValue(targetValue);
    // } else if (delta === 0) {
    //   // Make sure value is set even if delta is 0
    //   setValue(targetValue);
    // }
  }
);

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
  wsService.disconnect();
});
