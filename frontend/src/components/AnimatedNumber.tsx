import React, { useEffect, useRef, useState } from 'react';
import { motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { useCounterStore } from '../stores/counterStore';

export const AnimatedNumber: React.FC = () => {
  const { value, targetValue, isAnimating, setValue, setAnimating } = useCounterStore();
  const displayValue = useMotionValue(value);
  const animationRef = useRef<any>(null);
  const [displayNumber, setDisplayNumber] = useState(value);
  const lastTargetRef = useRef(targetValue);

  // Transform the motion value to rounded integer
  const rounded = useTransform(displayValue, (latest) => Math.round(latest));

  useEffect(() => {
    const unsubscribe = rounded.on('change', (latest) => {
      setDisplayNumber(latest);
    });
    return unsubscribe;
  }, [rounded]);

  useEffect(() => {
    const delta = Math.abs(targetValue - value);
    
    console.log('Animating from', value, 'to', targetValue, 'Delta:', delta);
    
    // Check if we're already animating to this target
    if (animationRef.current && lastTargetRef.current === targetValue) {
      console.log('Already animating to this target, skipping');
      return;
    }
    
    // Skip only if we're already at the target and not animating
    if (delta === 0 && value === targetValue && !animationRef.current) {
      displayValue.set(targetValue);
      return;
    }

    // Cancel any ongoing animation only if the target changed
    if (animationRef.current) {
      console.log('Stopping previous animation');
      animationRef.current.stop();
    }

    // Update last target
    lastTargetRef.current = targetValue;

    // Always animate when target changes
    setAnimating(true);
    
    // Calculate animation duration based on delta
    // Slower animation to see the numbers count up/down
    const duration = Math.min(Math.max(delta * 300, 800), 4000) / 1000; // 150ms per step, min 800ms, max 4s

    console.log(`Starting animation: ${duration}s for ${delta} steps`);

    animationRef.current = animate(value, targetValue, {
      duration,
      ease: [0.25, 0.1, 0.25, 1], // Custom easing for smooth counting
      onUpdate: (latest) => {
        displayValue.set(latest);
      },
      onComplete: () => {
        console.log('Animation complete');
        setValue(targetValue);
        setAnimating(false);
        animationRef.current = null;
      },
    });

    return () => {
      // Only stop if component unmounts
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [targetValue]); // Only depend on targetValue changes

  return (
    <motion.div
      className="relative"
      initial={{ scale: 1 }}
      animate={{ 
        scale: isAnimating ? [1, 1.15, 1.05, 1.1, 1] : 1,
        rotate: isAnimating ? [0, -2, 2, -1, 0] : 0,
      }}
      transition={{ 
        duration: 0.6,
        times: [0, 0.2, 0.5, 0.8, 1],
        ease: "easeInOut"
      }}
    >
      <motion.div
        className="text-8xl font-bold tabular-nums tracking-tight select-none"
        animate={{
          y: isAnimating ? [0, -10, 5, -2, 0] : 0,
        }}
        transition={{
          duration: 0.6,
          times: [0, 0.2, 0.5, 0.8, 1],
          ease: "easeOut"
        }}
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: isAnimating ? '0 0 20px rgba(102, 126, 234, 0.5)' : 'none',
        }}
      >
        <motion.span
          key={displayNumber}
          initial={{ opacity: 0.8, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.1 }}
        >
          {displayNumber.toLocaleString('en-US')}
        </motion.span>
      </motion.div>
      
      {/* Glow effect during animation */}
      <motion.div
        className="absolute inset-0 blur-2xl"
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: isAnimating ? [0, 0.4, 0.3, 0.35, 0] : 0,
          scale: isAnimating ? [1, 1.3, 1.2, 1.25, 1] : 1,
        }}
        transition={{
          duration: 0.6,
          times: [0, 0.2, 0.5, 0.8, 1]
        }}
        style={{
          background: 'radial-gradient(circle, rgba(102, 126, 234, 0.6) 0%, rgba(118, 75, 162, 0.4) 100%)',
          zIndex: -1,
        }}
      />
      
      {/* Particle effects during animation */}
      {isAnimating && (
        <>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: 'rgba(102, 126, 234, 0.8)',
                left: '50%',
                top: '50%',
              }}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                x: [0, (i - 1) * 40],
                y: [0, -40 - i * 10, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: "easeOut"
              }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
};
