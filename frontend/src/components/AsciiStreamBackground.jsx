import { useEffect, useRef } from "react";

const CHARACTERS = "ABCEGKRSXZ0235689";
const STREAM_OFFSETS = [-0.48, -0.35, -0.22, -0.09, 0.1, 0.23, 0.36, 0.49];
const STREAM_COLORS = [
    "#ff9ffc",
    "#d887ff",
    "#a66fff",
    "#725cff",
    "#725cff",
    "#a66fff",
    "#d887ff",
    "#ff9ffc",
];
const FRAME_INTERVAL = 1000 / 30;
const GLYPHS_PER_ROW = 22;

function AsciiStreamBackground() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: true });

        if (!canvas || !context) return undefined;

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const pointer = { x: -1000, y: -1000 };
        let animationFrame = 0;
        let lastFrame = 0;
        let width = 0;
        let height = 0;

        const draw = (time = 0) => {
            if (!width || !height) return;

            context.clearRect(0, 0, width, height);
            const originX = width * 0.58;
            const originY = height * 0.52;
            const beam = context.createLinearGradient(0, 0, originX, 0);
            beam.addColorStop(0, "#ff9ffc");
            beam.addColorStop(0.45, "#725cff");
            beam.addColorStop(1, "rgba(114, 92, 255, 0)");

            context.strokeStyle = beam;
            context.globalAlpha = 0.12;
            context.lineWidth = 16;
            context.beginPath();
            context.moveTo(0, originY);
            context.lineTo(originX, originY);
            context.stroke();
            context.globalAlpha = 0.8;
            context.lineWidth = 1;
            context.stroke();

            STREAM_OFFSETS.forEach((offset, streamIndex) => {
                const startX = -20;
                const startY = originY + offset * height;
                const controlX = originX * (0.34 + Math.abs(offset) * 0.14);
                const controlY = originY + offset * height * 0.52;
                const color = STREAM_COLORS[streamIndex];
                const ribbon = context.createLinearGradient(0, 0, originX, 0);
                ribbon.addColorStop(0, color);
                ribbon.addColorStop(0.72, color);
                ribbon.addColorStop(1, "rgba(114, 92, 255, 0)");

                context.strokeStyle = ribbon;
                context.globalAlpha = 0.1;
                context.lineWidth = 10;
                context.beginPath();
                context.moveTo(startX, startY);
                context.quadraticCurveTo(controlX, controlY, originX, originY);
                context.stroke();
                context.globalAlpha = 0.68;
                context.lineWidth = 0.8;
                context.stroke();
                context.globalAlpha = 0.6;
                context.lineWidth = 2.2;
                context.setLineDash([originX * 0.14, originX * 0.86]);
                context.lineDashOffset = -time * 0.055 - streamIndex * originX * 0.12;
                context.stroke();
                context.setLineDash([]);

                context.fillStyle = color;
                context.font = `600 ${11 + Math.abs(offset) * 5}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
                context.textAlign = "center";
                context.textBaseline = "middle";

                for (let row = 0; row < 2; row += 1) {
                    for (let index = 0; index < GLYPHS_PER_ROW; index += 1) {
                        const position = (
                            index / GLYPHS_PER_ROW
                            + time * 0.000065
                            + streamIndex * 0.031
                            + row * 0.018
                        ) % 1;
                        const inverse = 1 - position;
                        const x = inverse * inverse * startX
                            + 2 * inverse * position * controlX
                            + position * position * originX;
                        const y = inverse * inverse * startY
                            + 2 * inverse * position * controlY
                            + position * position * originY
                            + (row === 0 ? -1 : 1) * (4 + Math.abs(offset) * 5) * inverse;
                        const pulsePosition = (time * 0.000045 + streamIndex * 0.11) % 1;
                        const pulseDistance = Math.min(
                            Math.abs(position - pulsePosition),
                            1 - Math.abs(position - pulsePosition)
                        );
                        const pulse = Math.max(0, 1 - pulseDistance / 0.18) ** 2;
                        const pointerDistance = Math.hypot(x - pointer.x, y - pointer.y);
                        const ignite = Math.max(0, 1 - pointerDistance / 130);
                        const character = CHARACTERS[
                            (index * 7 + streamIndex * 11 + row * 3 + Math.floor(time / 2400))
                            % CHARACTERS.length
                        ];

                        context.globalAlpha = Math.min(
                            0.9,
                            (0.12 + pulse * 0.45 + Math.abs(offset) * 0.12 + ignite * 0.45)
                            * (1 - position * 0.58)
                        );
                        context.fillText(character, x, y);
                    }
                }
            });

            context.globalAlpha = 1;
        };

        const resize = () => {
            width = Math.ceil(canvas.clientWidth);
            height = Math.ceil(canvas.clientHeight);
            canvas.width = width;
            canvas.height = height;
            draw(performance.now());
        };

        const animate = (time) => {
            if (time - lastFrame >= FRAME_INTERVAL) {
                draw(time);
                lastFrame = time;
            }
            animationFrame = requestAnimationFrame(animate);
        };

        const updateAnimation = () => {
            cancelAnimationFrame(animationFrame);
            draw(performance.now());
            if (!reducedMotion.matches && !document.hidden) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        const updatePointer = (event) => {
            const bounds = canvas.getBoundingClientRect();
            pointer.x = event.clientX - bounds.left;
            pointer.y = event.clientY - bounds.top;
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        window.addEventListener("pointermove", updatePointer, { passive: true });
        document.addEventListener("visibilitychange", updateAnimation);
        reducedMotion.addEventListener("change", updateAnimation);
        resize();
        updateAnimation();

        return () => {
            cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            window.removeEventListener("pointermove", updatePointer);
            document.removeEventListener("visibilitychange", updateAnimation);
            reducedMotion.removeEventListener("change", updateAnimation);
        };
    }, []);

    return <canvas ref={canvasRef} className="login-ascii-stream" aria-hidden="true" />;
}

export default AsciiStreamBackground;
