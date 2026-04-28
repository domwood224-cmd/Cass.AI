import React, { useRef, useState, useMemo, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { Brain, Target, Star, Calendar, Orbit } from 'lucide-react';
import { cn } from '../lib/utils';
// import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'; // Not importing from three directly if not needed

export function KnowledgeGraphVisualizer({ data, className, isLearning }: { data: { nodes: any[], edges: any[] }, className?: string, isLearning?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>();
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [hoverNode, setHoverNode] = useState<any | null>(null);

  const getColor = useCallback((category: string, isHover: boolean = false) => {
    switch (category) {
      case 'technology': return isHover ? '#8a2be2' : '#601d9e'; // Violet
      case 'emotion': return isHover ? '#00f3ff' : '#00a9b3'; // Electric Cyan
      case 'time': return isHover ? '#39ff14' : '#29b30e'; // Neon Green
      case 'location': return isHover ? '#ff003c' : '#b3002a'; // Glitch Red
      case 'person': return isHover ? '#f8fafc' : '#94a3b8'; // Pearl/Silver
      case 'action': return isHover ? '#00ff66' : '#00b347'; // Bright Emerald
      case 'abstract': return isHover ? '#c084fc' : '#9333ea'; // Amethyst
      case 'entity': return isHover ? '#60a5fa' : '#2563eb'; // Royal Blue
      default: return isHover ? '#d4d4d8' : '#71717a'; // Zinc
    }
  }, []);

  const hoverNodeRef = useRef<any | null>(null);

  const materials = useMemo(() => {
    const cats = ['technology', 'emotion', 'time', 'location', 'person', 'action', 'abstract', 'entity', 'default'];
    const mats: Record<string, THREE.Material> = {};
    
    cats.forEach(cat => {
      const color = new THREE.Color(getColor(cat, false));
      const hoverColor = new THREE.Color(getColor(cat, true));
      
      // Core (Soma) - Dense inner nucleus
      mats[`${cat}_core`] = new THREE.MeshPhongMaterial({ 
        color: color, 
        emissive: color, 
        emissiveIntensity: 0.3,
        shininess: 100
      });
      mats[`${cat}_core_hover`] = new THREE.MeshPhongMaterial({ 
        color: hoverColor, 
        emissive: hoverColor, 
        emissiveIntensity: 0.6,
        shininess: 100
      });

      // Shell (Dendrites/Synaptic field) - Ethereal outer glow
      mats[`${cat}_shell`] = new THREE.MeshPhysicalMaterial({ 
        color: color, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.4,
        roughness: 0.2,
        transmission: 0.9,
      });
      mats[`${cat}_shell_hover`] = new THREE.MeshPhysicalMaterial({ 
        color: hoverColor, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.8,
        emissive: hoverColor,
        emissiveIntensity: 0.5
      });
      
      // Heartbeat/Syncing Material
      mats['sync_core'] = new THREE.MeshPhongMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.8 });
      mats['sync_shell'] = new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, wireframe: true, transparent: true, opacity: 0.8, emissive: 0xf59e0b, emissiveIntensity: 0.5 });
    });
    return mats;
  }, []);

  const geometries = useMemo(() => {
    return {
      core: new THREE.SphereGeometry(1, 16, 16),
      // Icosahedron gives a branching, irregular "dendrite" look when wireframed
      shell: new THREE.IcosahedronGeometry(1.6, 2) 
    };
  }, []);

  const graphData = useMemo(() => {
    // Clone data for ForceGraph
    const nodes = data.nodes.map(n => ({ ...n }));
    const links = data.edges.map(e => ({ ...e, source: e.source.id || e.source, target: e.target.id || e.target }));
    return { nodes, links };
  }, [data]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    
    // Camera zoom
    if (graphRef.current) {
      const distance = 40;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
      graphRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node, // lookAt
        3000  // ms transition
      );
    }
  }, []);

  if (data.nodes.length === 0) {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center text-zinc-300 relative", className || "h-[400px]")}>
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full scale-150"></div>
          <Orbit className="w-16 h-16 mb-6 opacity-30 text-indigo-300 relative z-10 animate-[spin_20s_linear_infinite]" />
        </div>
        <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300">NEURAL LATTICE EMPTY</span>
        <span className="text-[10px] mt-3 text-zinc-300 tracking-widest uppercase font-light">Awaiting spatial input...</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("w-full bg-transparent relative overflow-hidden", className || "h-full min-h-[400px]")}>
      <div className="absolute inset-0 bg-transparent pointer-events-none z-0"></div>
      
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        nodeLabel="label"
        nodeThreeObject={(node: any) => {
          const group = new THREE.Group();
          const isRecent = Date.now() - (node.lastAccessed || node.created) < 300000;
          const isHovered = node === hoverNode;
          
          let cat = node.category || 'default';
          if (!materials[`${cat}_core`]) cat = 'default';

          const stateSuffix = isHovered ? '_hover' : '';
          
          // Core soma
          const coreMat = (isLearning && isRecent) ? materials['sync_core'] : materials[`${cat}_core${stateSuffix}`];
          const core = new THREE.Mesh(geometries.core, coreMat);
          
          // Outer dendrite shell
          const shellMat = (isLearning && isRecent) ? materials['sync_shell'] : materials[`${cat}_shell${stateSuffix}`];
          // Give shell a glow effect with additive blending
          if (shellMat instanceof THREE.Material) {
             shellMat.blending = THREE.AdditiveBlending;
          }
          const shell = new THREE.Mesh(geometries.shell, shellMat);
          
          const size = 3 + (node.importance * 3);
          core.scale.set(size, size, size);
          shell.scale.set(size, size, size);

          group.add(core);
          group.add(shell);
          
          node.__core = core;
          node.__shell = shell;
          node.__rotationSpeed = (Math.random() - 0.5) * 0.0055;
          node.__pulseSpeed = 0.22 + Math.random() * 0.33;
          node.__pulseOffset = Math.random() * Math.PI * 2;
          
          return group;
        }}
        linkLabel="type"
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        linkColor={(link: any) => {
          const cat = link.source?.category || 'default';
          const baseColor = getColor(cat, false);
          return baseColor;
        }}
        linkWidth={(link: any) => Math.sqrt(link.confidence || 0.5) * 2.5}
        linkDirectionalParticles={(link: any) => link.confidence ? Math.floor(link.confidence * 8) : 3}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleSpeed={0.00088}
        linkDirectionalParticleColor={(link: any) => {
          const cat = link.source?.category || 'default';
          return getColor(cat, true);
        }}
        onNodeClick={handleNodeClick}
        onNodeHover={(node) => {
          setHoverNode(node);
          if (graphRef.current) {
            setTimeout(() => {}, 10);
          }
        }}
        onBackgroundClick={() => setSelectedNode(null)}
        onEngineTick={() => {
          if (!graphRef.current) return;
          const time = Date.now() * 0.00011;
          
          // Auto rotate the entire graph slightly
          const controls = graphRef.current.controls();
          if (controls && !controls.autoRotate) {
             controls.autoRotate = true;
             controls.autoRotateSpeed = 0.055;
          }

          graphData.nodes.forEach((node: any) => {
             if (node.__shell) {
                node.__shell.rotation.x += node.__rotationSpeed;
                node.__shell.rotation.y += node.__rotationSpeed;
             }
             if (node.__core) {
                const scale = 1 + Math.sin(time * node.__pulseSpeed + node.__pulseOffset) * 0.05;
                const size = 3 + (node.importance * 3);
                node.__core.scale.set(size * scale, size * scale, size * scale);
             }
          });
        }}
        // Allow adding text sprites for nodes if desired, but default spheres look sleeker
      />

      {/* Overlay for selected node */}
      {selectedNode && (
        <div className="absolute right-6 top-6 z-10 w-72 backdrop-blur-3xl bg-white/10 border border-white/20 rounded-[2.5rem] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] pointer-events-auto transform transition-all duration-300">
          <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-zinc-400/10 rounded-[2.5rem] blur-xl opacity-80 -z-10"></div>
          <div className="flex items-start justify-between mb-5">
            <h4 className="text-lg font-light tracking-wide text-zinc-100 capitalize flex items-center gap-3">
              <Orbit className="w-5 h-5 text-indigo-400 animate-[spin_20s_linear_infinite]" />
              {selectedNode.label}
            </h4>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNode(null);
              }}
              className="text-zinc-300 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
            >
              ×
            </button>
          </div>
          
          <div className="inline-block px-3 py-1 bg-white/10 rounded-full border border-white/5 mb-4 shadow-inner">
             <span className="text-[10px] uppercase font-medium tracking-[0.1em] text-indigo-300">
               {selectedNode.category || 'CONCEPT'}
             </span>
          </div>

          <p className="text-[13px] text-zinc-300 mb-6 line-clamp-4 leading-relaxed font-light">
             {selectedNode.content || `Entity captured via interaction. Core context integrated into semantic model.`}
          </p>

          <div className="space-y-4 bg-black/20 rounded-3xl p-4 border border-white/5 shadow-inner">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-200 flex items-center gap-2 uppercase tracking-widest text-[9px] font-medium"><Target className="w-3 h-3 text-indigo-400/60" /> Synaptic Weight</span>
              <span className="font-mono text-zinc-200">{(selectedNode.importance * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-200 flex items-center gap-2 uppercase tracking-widest text-[9px] font-medium"><Star className="w-3 h-3 text-purple-400/60" /> Activations</span>
              <span className="font-mono text-zinc-200">{selectedNode.accessCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-200 flex items-center gap-2 uppercase tracking-widest text-[9px] font-medium"><Calendar className="w-3 h-3 text-zinc-300" /> Initialized</span>
              <span className="font-mono text-zinc-200">{new Date(selectedNode.created).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Legend removed to avoid blocking graph */}
    </div>
  );
}

