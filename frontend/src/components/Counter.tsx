import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, AlertCircle, Loader2 } from 'lucide-react';
import { useCounterStore } from '../stores/counterStore';
import { AnimatedNumber } from './AnimatedNumber';

export const Counter: React.FC = () => {
  const { 
    value, 
    isLoading, 
    error, 
    isAnimating,
    increment, 
    decrement, 
    fetchValue,
    reset,
    operationCount,
    lastOperation
  } = useCounterStore();

  useEffect(() => {
    // Only fetch once on mount
    let mounted = true;
    
    if (mounted) {
      fetchValue();
    }
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - only run once

  const canDecrement = value > 0 && !isLoading && !isAnimating;
  const canIncrement = value < 1_000_000_000 && !isLoading && !isAnimating;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-12 max-w-md w-full border border-white/20"
      >
        {/* Title */}
        <motion.h1 
          className="text-4xl font-bold text-white text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Number Acidizer
        </motion.h1>

        {/* Counter Display */}
        <div className="flex justify-center mb-12">
          <AnimatedNumber />
        </div>

        {/* Buttons */}
        <div className="flex gap-4 justify-center mb-8">
          <motion.button
            onClick={decrement}
            disabled={!canDecrement}
            className={`
              relative group px-8 py-4 rounded-2xl font-semibold text-lg
              transition-all duration-200 transform
              ${canDecrement 
                ? 'bg-red-500 hover:bg-red-600 text-white hover:scale-105 shadow-lg hover:shadow-red-500/50' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
              }
            `}
            whileTap={canDecrement ? { scale: 0.95 } : {}}
          >
            <span className="flex items-center gap-2">
              <Minus size={20} />
              Decrement
            </span>
            {lastOperation === 'decrement' && isLoading && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-white/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
          </motion.button>

          <motion.button
            onClick={increment}
            disabled={!canIncrement}
            className={`
              relative group px-8 py-4 rounded-2xl font-semibold text-lg
              transition-all duration-200 transform
              ${canIncrement 
                ? 'bg-green-500 hover:bg-green-600 text-white hover:scale-105 shadow-lg hover:shadow-green-500/50' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
              }
            `}
            whileTap={canIncrement ? { scale: 0.95 } : {}}
          >
            <span className="flex items-center gap-2">
              <Plus size={20} />
              Increment
            </span>
            {lastOperation === 'increment' && isLoading && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-white/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
          </motion.button>
        </div>

        {/* Status Indicators */}
        <div className="flex justify-center items-center gap-4 mb-4">
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2 text-blue-400"
            >
              <Loader2 className="animate-spin" size={16} />
              <span className="text-sm">Updating...</span>
            </motion.div>
          )}
          
          {isAnimating && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-purple-400 text-sm"
            >
              Animating...
            </motion.div>
          )}
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-4"
            >
              <div className="flex items-center gap-2 text-red-300">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
              <button
                onClick={reset}
                className="mt-2 text-sm text-red-200 hover:text-white transition-colors"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        {operationCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-gray-400 text-sm"
          >
            {operationCount} operations performed this session
          </motion.div>
        )}

        {/* Limits Info */}
        <div className="mt-8 text-center text-gray-500 text-xs">
          <p>Range: 0 - 1,000,000,000</p>
          <p className="mt-1">Real-time sync across all devices</p>
        </div>
      </motion.div>
    </div>
  );
};
