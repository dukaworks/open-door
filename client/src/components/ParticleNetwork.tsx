/*
 * ParticleNetwork.tsx — 动态粒子网络组件
 * Canvas-based constellation effect with gradient connections
 */

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  baseColor: { r: number; g: number; b: number };
  pulse: number;
  pulseSpeed: number;
}

interface ParticleNetworkProps {
  particleCount?: number;
  connectionDistance?: number;
  className?: string;
}

const COLORS = [
  { r: 139, g: 92, b: 246 },   // Purple 紫色
  { r: 6, g: 182, b: 212 },    // Cyan 青色
  { r: 255, g: 255, b: 255 },  // White 白色
  { r: 236, g: 72, b: 153 },   // Pink 粉色
];

export function ParticleNetwork({
  particleCount = 20,
  connectionDistance = 150,
  className = "",
}: ParticleNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize particles
    const initParticles = () => {
      const rect = canvas.getBoundingClientRect();
      particlesRef.current = Array.from({ length: particleCount }, () => {
        const colorObj = COLORS[Math.floor(Math.random() * COLORS.length)];
        return {
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 3 + 2,
          color: `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, 0.9)`,
          baseColor: colorObj,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.02 + 0.01,
        };
      });
    };
    initParticles();

    // Mouse interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const handleMouseLeave = () => {
      mouseRef.current = null;
    };
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    // Animation loop
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Update and draw particles
      particlesRef.current.forEach((particle) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.pulse += particle.pulseSpeed;

        // Bounce off edges
        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;

        // Mouse interaction
        if (mouseRef.current) {
          const dx = mouseRef.current.x - particle.x;
          const dy = mouseRef.current.y - particle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            particle.vx += dx * 0.0005;
            particle.vy += dy * 0.0005;
          }
        }

        // Limit velocity
        const maxSpeed = 1.5;
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > maxSpeed) {
          particle.vx = (particle.vx / speed) * maxSpeed;
          particle.vy = (particle.vy / speed) * maxSpeed;
        }

        // Draw particle with glow
        const glowRadius = particle.radius + Math.sin(particle.pulse) * 1.5;
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, glowRadius * 3
        );
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.3, particle.color.replace("0.9", "0.5"));
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowRadius * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw core
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
      });

      // Draw connections
      particlesRef.current.forEach((p1, i) => {
        particlesRef.current.slice(i + 1).forEach((p2) => {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            // Calculate gradient between the two particle colors
            const alpha = 1 - dist / connectionDistance;
            const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            
            const c1 = p1.baseColor;
            const c2 = p2.baseColor;
            
            gradient.addColorStop(0, `rgba(${c1.r}, ${c1.g}, ${c1.b}, ${alpha * 0.6})`);
            gradient.addColorStop(0.5, `rgba(${Math.round((c1.r + c2.r) / 2)}, ${Math.round((c1.g + c2.g) / 2)}, ${Math.round((c1.b + c2.b) / 2)}, ${alpha * 0.8})`);
            gradient.addColorStop(1, `rgba(${c2.r}, ${c2.g}, ${c2.b}, ${alpha * 0.6})`);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationRef.current);
    };
  }, [particleCount, connectionDistance]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ zIndex: 3, pointerEvents: "auto" }}
    />
  );
}
