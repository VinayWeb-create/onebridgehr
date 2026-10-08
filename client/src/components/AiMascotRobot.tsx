import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type RobotState =
  | 'idle'
  | 'email'
  | 'password_hidden'
  | 'password_visible'
  | 'loading'
  | 'success'
  | 'failed';

interface AiMascotRobotProps {
  state: RobotState;
  customSpeech?: string;
  isMobile?: boolean;
}

const DEFAULT_SPEECH: Record<RobotState, { desktop: string; mobile: string }> = {
  idle: {
    desktop: 'Welcome back! 👋',
    mobile: "Let's get started! 🚀",
  },
  email: {
    desktop: 'Typing your email... ✍️',
    mobile: 'Enter your email ✉️',
  },
  password_hidden: {
    desktop: "Privacy mode! 🙈 I won't peek.",
    mobile: 'Privacy mode 🔒',
  },
  password_visible: {
    desktop: 'Peek-a-boo! 👀 Keep it secret!',
    mobile: 'Password visible 👀',
  },
  loading: {
    desktop: 'Verifying credentials... ⚡',
    mobile: 'Authenticating... ⚡',
  },
  success: {
    desktop: 'Access Granted! 🎉 Welcome back!',
    mobile: 'Welcome back! 🎉',
  },
  failed: {
    desktop: "Oops! Let's try again. 🤔",
    mobile: 'Try again ⚠️',
  },
};

const MASCOT_IMAGES: Record<string, string> = {
  idle: '/mascot/robot_head.jpg',
  email: '/mascot/robot_typing.jpg',
  password_hidden: '/mascot/robot_password.jpg',
  password_visible: '/mascot/robot_head.jpg',
  loading: '/mascot/robot_head.jpg',
  success: '/mascot/robot_success.jpg',
  failed: '/mascot/robot_confused.jpg',
};

export const AiMascotRobot: React.FC<AiMascotRobotProps> = ({
  state,
  customSpeech,
  isMobile = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  // Mouse tracking with smooth lerp
  useEffect(() => {
    let animationFrameId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (window.innerWidth / 2)));
      const deltaY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (window.innerHeight / 2)));

      targetX = deltaX * 8; // subtle degrees
      targetY = -deltaY * 6; // subtle degrees
    };

    const updatePosition = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      setMouseOffset({ x: currentX, y: currentY });
      animationFrameId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationFrameId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Natural Blinking Cycle (Every 3.8 to 5.5s)
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3800 + Math.random() * 1800);

    return () => clearInterval(blinkInterval);
  }, []);

  const speechText =
    customSpeech || (isMobile ? DEFAULT_SPEECH[state].mobile : DEFAULT_SPEECH[state].desktop);

  const imgSrc = MASCOT_IMAGES[state] || MASCOT_IMAGES.idle;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center select-none"
    >
      {/* 3D Robot Head Avatar Container */}
      <motion.div
        animate={{
          y: state === 'success' ? [0, -8, 0] : [0, -5, 0],
          rotateX: mouseOffset.y,
          rotateY: mouseOffset.x,
        }}
        transition={{
          y: {
            repeat: Infinity,
            repeatType: 'mirror',
            duration: state === 'loading' ? 1.2 : 3.2,
            ease: 'easeInOut',
          },
          rotateX: { type: 'spring', stiffness: 200, damping: 20 },
          rotateY: { type: 'spring', stiffness: 200, damping: 20 },
        }}
        className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center"
      >
        {/* Soft Glowing Neon Halo Behind Head */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-500/40 via-amber-400/30 to-orange-600/40 blur-xl pointer-events-none scale-125" />

        {/* Circular Halo Ring */}
        <div className="absolute inset-1 rounded-full border-2 border-orange-500/60 shadow-[0_0_20px_rgba(243,112,33,0.5)] pointer-events-none" />

        {/* Loading Spinner Ring */}
        {state === 'loading' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-2 border-t-orange-400 border-r-transparent border-b-orange-500 border-l-transparent pointer-events-none shadow-[0_0_25px_rgba(243,112,33,0.6)]"
          />
        )}

        {/* Confetti Explosion on Success */}
        {state === 'success' && (
          <div className="absolute inset-0 pointer-events-none z-40 overflow-visible">
            {[...Array(14)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                animate={{
                  opacity: [1, 1, 0],
                  scale: [0, 1.2, 0.8],
                  x: (Math.random() - 0.5) * 180,
                  y: (Math.random() - 0.7) * 180,
                  rotate: Math.random() * 360,
                }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="absolute left-1/2 top-1/2 w-2 h-2 rounded-sm"
                style={{
                  backgroundColor: ['#f37021', '#fbbf24', '#ffffff', '#38bdf8'][i % 4],
                }}
              />
            ))}
          </div>
        )}

        {/* Circular Masked Robot Head Avatar */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-950 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.img
              key={imgSrc}
              src={imgSrc}
              alt="Onebridge AI Mascot"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="w-full h-full object-cover filter contrast-[1.05]"
            />
          </AnimatePresence>

          {/* Blink Overlay */}
          {blink && state !== 'password_hidden' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              className="absolute top-[35%] left-[25%] right-[25%] h-2 bg-slate-950/90 rounded-full blur-[1px] pointer-events-none"
            />
          )}
        </div>
      </motion.div>

      {/* Speech Bubble Placed to the Right of the Mascot Head */}
      <AnimatePresence mode="wait">
        <motion.div
          key={speechText}
          initial={{ opacity: 0, x: -8, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -6, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative z-30 ml-3 px-3.5 py-1.5 rounded-2xl bg-slate-900/90 border border-orange-500/40 shadow-xl backdrop-blur-md whitespace-nowrap text-xs font-bold text-white flex items-center gap-1.5"
        >
          <span>{speechText}</span>
          {/* Bubble Tail pointing to the robot head */}
          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-slate-900 border-l border-b border-orange-500/40 rotate-45" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
