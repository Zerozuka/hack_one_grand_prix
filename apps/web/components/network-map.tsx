"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

type NetworkNode = {
  id: string;
  name: string;
  groupLabel: string;
  nodeRole: string;
  relationshipCount: number;
};

type NetworkEdge = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  type: string;
  strength: number;
};

type PositionedNode = NetworkNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type ThemeName = "light" | "dark";

const width = 980;
const height = 620;
const center = { x: width / 2, y: height / 2 };

const palettes = {
  light: {
    panel: "bg-white text-stone-950 border-stone-200",
    canvas: "#f8fafc",
    grid: "#e2e8f0",
    edge: "#94a3b8",
    edgeActive: "#2563eb",
    labelFill: "#ffffff",
    labelStroke: "#cbd5e1",
    labelText: "#0f172a",
    mutedText: "#64748b",
    halo: "#60a5fa",
    roles: {
      bridge: "#f97316",
      core: "#2563eb",
      new: "#16a34a",
      isolated: "#64748b",
    },
  },
  dark: {
    panel: "bg-[#0b1020] text-slate-50 border-slate-700",
    canvas: "#111827",
    grid: "#263244",
    edge: "#475569",
    edgeActive: "#38bdf8",
    labelFill: "#111827",
    labelStroke: "#334155",
    labelText: "#f8fafc",
    mutedText: "#cbd5e1",
    halo: "#38bdf8",
    roles: {
      bridge: "#fb923c",
      core: "#38bdf8",
      new: "#4ade80",
      isolated: "#94a3b8",
    },
  },
} as const;

function roleColor(role: string, theme: ThemeName) {
  const roles = palettes[theme].roles;
  if (role === "bridge" || role === "core" || role === "new" || role === "isolated") {
    return roles[role];
  }
  return roles.isolated;
}

function initialLayout(nodes: NetworkNode[], selectedUserId: string): PositionedNode[] {
  const groups = [...new Set(nodes.map((node) => node.groupLabel))];
  const groupRadius = 185;

  return nodes.map((node, index) => {
    if (node.id === selectedUserId) {
      return { ...node, x: center.x, y: center.y, vx: 0, vy: 0 };
    }

    const groupIndex = Math.max(groups.indexOf(node.groupLabel), 0);
    const groupAngle = (Math.PI * 2 * groupIndex) / Math.max(groups.length, 1) - Math.PI / 2;
    const localAngle = groupAngle + ((index % 5) - 2) * 0.22;
    const localRadius = groupRadius + (index % 3) * 48;

    return {
      ...node,
      x: center.x + Math.cos(localAngle) * localRadius,
      y: center.y + Math.sin(localAngle) * localRadius,
      vx: 0,
      vy: 0,
    };
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function labelWidth(name: string) {
  return clamp(name.length * 13 + 58, 118, 210);
}

export function NetworkMap({
  nodes,
  edges,
  selectedUserId,
  initialTheme,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedUserId: string;
  initialTheme?: ThemeName;
}) {
  const [theme, setTheme] = useState<ThemeName>(initialTheme ?? "light");
  const [positions, setPositions] = useState<PositionedNode[]>(() =>
    initialLayout(nodes, selectedUserId),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState(selectedUserId);
  const pointerOffset = useRef({ x: 0, y: 0 });
  const simulationRef = useRef<PositionedNode[]>([]);
  const palette = palettes[theme];
  const focusedNode = positions.find((node) => node.id === focusedId) ?? positions[0];

  useEffect(() => {
    if (initialTheme) {
      setTheme(initialTheme);
      return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, [initialTheme]);

  useEffect(() => {
    const next = initialLayout(nodes, selectedUserId);
    simulationRef.current = next;
    setPositions(next);
    setFocusedId(selectedUserId);
  }, [nodes, selectedUserId]);

  useEffect(() => {
    let frame = 0;
    let raf = 0;
    const edgePairs = edges
      .map((edge) => ({
        edge,
        sourceIndex: nodes.findIndex((node) => node.id === edge.from_user_id),
        targetIndex: nodes.findIndex((node) => node.id === edge.to_user_id),
      }))
      .filter((item) => item.sourceIndex >= 0 && item.targetIndex >= 0);

    function tick() {
      const current = simulationRef.current.map((node) => ({ ...node }));

      for (let i = 0; i < current.length; i += 1) {
        for (let j = i + 1; j < current.length; j += 1) {
          const a = current[i];
          const b = current[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.max(Math.hypot(dx, dy), 24);
          const force = 980 / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      for (const { edge, sourceIndex, targetIndex } of edgePairs) {
        const source = current[sourceIndex];
        const target = current[targetIndex];
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const targetDistance = edge.from_user_id === selectedUserId || edge.to_user_id === selectedUserId ? 165 : 210;
        const force = (distance - targetDistance) * 0.004 * Math.max(edge.strength, 1);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      for (const node of current) {
        const pinned = node.id === draggingId;
        const centerPull = node.id === selectedUserId ? 0.018 : 0.006;
        node.vx += (center.x - node.x) * centerPull;
        node.vy += (center.y - node.y) * centerPull;

        if (!pinned) {
          node.x = clamp(node.x + node.vx, 80, width - 80);
          node.y = clamp(node.y + node.vy, 80, height - 90);
        }
        node.vx *= 0.76;
        node.vy *= 0.76;
      }

      simulationRef.current = current;
      frame += 1;
      if (frame % 2 === 0) {
        setPositions(current);
      }
      raf = window.requestAnimationFrame(tick);
    }

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [draggingId, edges, nodes, selectedUserId]);

  const connectedIds = new Set(
    edges.flatMap((edge) =>
      edge.from_user_id === focusedId
        ? [edge.to_user_id]
        : edge.to_user_id === focusedId
          ? [edge.from_user_id]
          : [],
    ),
  );
  const positionMap = new Map(positions.map((node) => [node.id, node]));

  function moveNode(id: string, x: number, y: number) {
    const next = simulationRef.current.map((node) =>
      node.id === id
        ? { ...node, x: clamp(x, 80, width - 80), y: clamp(y, 80, height - 90), vx: 0, vy: 0 }
        : node,
    );
    simulationRef.current = next;
    setPositions(next);
  }

  function pointerToCanvas(event: PointerEvent<SVGElement>) {
    const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    };
  }

  return (
    <section
      id="network"
      className={`overflow-hidden rounded-lg border p-4 shadow-[0_12px_45px_rgba(15,23,42,0.08)] ${palette.panel}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] opacity-65">Knowledge Network</p>
          <h2 className="mt-2 text-xl font-semibold">知見ネットワーク</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Light theme"
            title="Light theme"
            onClick={() => setTheme("light")}
            className={`grid h-9 w-9 place-items-center rounded-md border text-sm transition ${
              theme === "light" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-current/20"
            }`}
          >
            L
          </button>
          <button
            type="button"
            aria-label="Dark theme"
            title="Dark theme"
            onClick={() => setTheme("dark")}
            className={`grid h-9 w-9 place-items-center rounded-md border text-sm transition ${
              theme === "dark" ? "border-sky-400 bg-sky-950 text-sky-100" : "border-current/20"
            }`}
          >
            D
          </button>
          <button
            type="button"
            onClick={() => {
              const next = initialLayout(nodes, selectedUserId);
              simulationRef.current = next;
              setPositions(next);
              setFocusedId(selectedUserId);
            }}
            className="h-9 rounded-md border border-current/20 px-3 text-xs font-semibold transition hover:bg-current/5"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="overflow-hidden rounded-lg border border-current/10">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block aspect-[1.58/1] w-full cursor-default touch-none"
            style={{ background: palette.canvas }}
            onPointerMove={(event) => {
              if (!draggingId) {
                return;
              }
              const svg = event.currentTarget;
              const rect = svg.getBoundingClientRect();
              const x = ((event.clientX - rect.left) / rect.width) * width - pointerOffset.current.x;
              const y = ((event.clientY - rect.top) / rect.height) * height - pointerOffset.current.y;
              moveNode(draggingId, x, y);
            }}
            onPointerUp={() => setDraggingId(null)}
            onPointerLeave={() => setDraggingId(null)}
          >
            <defs>
              <pattern id={`network-grid-${theme}`} width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke={palette.grid} strokeWidth="1" opacity="0.45" />
              </pattern>
            </defs>
            <rect width={width} height={height} fill={`url(#network-grid-${theme})`} />

            <g>
              {edges.map((edge) => {
                const source = positionMap.get(edge.from_user_id);
                const target = positionMap.get(edge.to_user_id);
                if (!source || !target) {
                  return null;
                }
                const active = edge.from_user_id === focusedId || edge.to_user_id === focusedId;
                return (
                  <line
                    key={edge.id}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={active ? palette.edgeActive : palette.edge}
                    strokeOpacity={active ? 0.9 : 0.42}
                    strokeWidth={active ? Math.max(edge.strength, 2.5) : 1.4}
                  />
                );
              })}
            </g>

            <g>
              {positions.map((node) => {
                const focused = node.id === focusedId;
                const selected = node.id === selectedUserId;
                const connected = connectedIds.has(node.id);
                const color = roleColor(node.nodeRole, theme);
                const labelW = labelWidth(node.name);
                const labelX = clamp(node.x - labelW / 2, 18, width - labelW - 18);
                const labelY = clamp(node.y + 22, 18, height - 58);

                return (
                  <g key={node.id}>
                    {focused ? (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="34"
                        fill="none"
                        stroke={palette.halo}
                        strokeOpacity="0.32"
                        strokeWidth="12"
                      />
                    ) : null}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={selected ? 17 : 13}
                      fill={color}
                      opacity={focused || connected || selected ? 1 : 0.74}
                      stroke={theme === "dark" ? "#0f172a" : "#ffffff"}
                      strokeWidth={selected ? 4 : 2}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setDraggingId(node.id);
                        setFocusedId(node.id);
                        const point = pointerToCanvas(event);
                        pointerOffset.current = { x: point.x - node.x, y: point.y - node.y };
                      }}
                      className="cursor-grab active:cursor-grabbing"
                    />
                    <g
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setDraggingId(node.id);
                        setFocusedId(node.id);
                        const point = pointerToCanvas(event);
                        pointerOffset.current = { x: point.x - node.x, y: point.y - node.y };
                      }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <rect
                        x={labelX}
                        y={labelY}
                        width={labelW}
                        height="44"
                        rx="7"
                        fill={palette.labelFill}
                        stroke={focused ? palette.edgeActive : palette.labelStroke}
                        strokeWidth={focused ? 2 : 1}
                        opacity={focused || connected || selected ? 0.98 : 0.9}
                      />
                      <text
                        x={labelX + 12}
                        y={labelY + 18}
                        fill={palette.labelText}
                        className="text-[12px] font-semibold"
                      >
                        {node.name}
                      </text>
                      <text x={labelX + 12} y={labelY + 34} fill={palette.mutedText} className="text-[10px]">
                        {node.groupLabel} / {node.relationshipCount} edges
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <aside className="rounded-lg border border-current/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] opacity-60">Focus</p>
          <h3 className="mt-2 text-lg font-semibold">{focusedNode?.name ?? "No node"}</h3>
          <p className="mt-1 text-sm opacity-70">{focusedNode?.groupLabel}</p>

          <div className="mt-5 grid gap-2">
            {[
              ["bridge", "Bridge"],
              ["core", "Core"],
              ["new", "New"],
              ["isolated", "Isolated"],
            ].map(([role, label]) => (
              <div key={role} className="flex items-center justify-between rounded-md border border-current/10 px-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: roleColor(role, theme) }}
                  />
                  {label}
                </span>
                <span className="text-xs opacity-60">
                  {nodes.filter((node) => node.nodeRole === role).length}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
