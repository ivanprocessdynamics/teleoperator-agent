"use client";

import { useEffect, useRef } from "react";

interface Point {
    x: number;
    y: number;
    originX: number;
    originY: number;
}

export function InteractiveGridBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const pointsRef = useRef<Point[]>([]);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const spacing = 24;
        const dotRadius = 1.2;
        const influenceRadius = 120;
        const maxDisplacement = 20;

        const initPoints = () => {
            const points: Point[] = [];
            const cols = Math.ceil(canvas.width / spacing) + 1;
            const rows = Math.ceil(canvas.height / spacing) + 1;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const x = col * spacing;
                    const y = row * spacing;
                    points.push({ x, y, originX: x, originY: y });
                }
            }
            pointsRef.current = points;
        };

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initPoints();
        };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        };

        const handleMouseLeave = () => {
            mouseRef.current = { x: -1000, y: -1000 };
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const mouse = mouseRef.current;

            for (const point of pointsRef.current) {
                const dx = mouse.x - point.originX;
                const dy = mouse.y - point.originY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < influenceRadius) {
                    const force = (1 - distance / influenceRadius) * maxDisplacement;
                    const angle = Math.atan2(dy, dx);
                    point.x = point.originX - Math.cos(angle) * force;
                    point.y = point.originY - Math.sin(angle) * force;
                } else {
                    // Spring back to origin
                    point.x += (point.originX - point.x) * 0.15;
                    point.y += (point.originY - point.y) * 0.15;
                }

                ctx.beginPath();
                ctx.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
                ctx.fillStyle = "#d1d5db"; // gray-300
                ctx.fill();
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        resize();
        window.addEventListener("resize", resize);
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseleave", handleMouseLeave);
        animationRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener("resize", resize);
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("mouseleave", handleMouseLeave);
            cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-auto"
            style={{ zIndex: 0 }}
        />
    );
}
