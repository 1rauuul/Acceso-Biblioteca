"use client";

import { useEffect, useState } from "react";

const COLORS = [
  "#1e40af",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

const PARTICLE_COUNT = 50;

interface Particle {
  id: number;
  x: number;
  color: string;
  duration: number;
  delay: number;
  rotation: number;
  size: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: 2 + Math.random() * 2,
    delay: Math.random() * 0.8,
    rotation: 360 + Math.random() * 720,
    size: 6 + Math.random() * 6,
  }));
}

export function Confetti() {
  const [visible, setVisible] = useState(true);
  const [particles] = useState(generateParticles);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 block animate-confetti-fall rounded-sm"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 1.4,
            backgroundColor: p.color,
            ["--duration" as string]: `${p.duration}s`,
            ["--delay" as string]: `${p.delay}s`,
            ["--rotation" as string]: `${p.rotation}deg`,
          }}
        />
      ))}
    </div>
  );
}
