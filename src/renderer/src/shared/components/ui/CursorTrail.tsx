'use client';

import { useEffect, useState, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
}

const COLORS = [
  'rgba(59, 130, 246, 0.8)', // blue
  'rgba(139, 92, 246, 0.8)', // purple
  'rgba(236, 72, 153, 0.8)', // pink
  'rgba(251, 146, 60, 0.8)', // orange
  'rgba(34, 197, 94, 0.8)', // green
  'rgba(14, 165, 233, 0.8)', // cyan
];

const NeonCursor = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    let particleId = 0;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      // Calculate velocity
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      const speed = Math.sqrt(dx * dx + dy * dy);

      // Create particles based on speed
      if (speed > 1) {
        const newParticles: Particle[] = [];
        const count = Math.min(Math.floor(speed / 10), 3);

        for (let i = 0; i < count; i++) {
          newParticles.push({
            x: e.clientX + (Math.random() - 0.5) * 10,
            y: e.clientY + (Math.random() - 0.5) * 10,
            size: Math.random() * 4 + 2,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            life: 1,
            maxLife: Math.random() * 30 + 20,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
          });
        }

        setParticles((prev) => [...prev, ...newParticles].slice(-50));
      }

      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const animate = () => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life + 1,
            vx: p.vx * 0.98,
            vy: p.vy * 0.98,
          }))
          .filter((p) => p.life < p.maxLife),
      );

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Particles */}
      {particles.map((particle, i) => {
        const opacity = 1 - particle.life / particle.maxLife;
        return (
          <div
            key={i}
            className="fixed pointer-events-none z-[9999] rounded-full"
            style={{
              left: `${particle.x}px`,
              top: `${particle.y}px`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: particle.color,
              opacity,
              transform: 'translate(-50%, -50%)',
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}, 0 0 ${particle.size * 4}px ${particle.color}`,
              transition: 'opacity 0.1s ease-out',
            }}
          />
        );
      })}
    </>
  );
};

export default NeonCursor;
