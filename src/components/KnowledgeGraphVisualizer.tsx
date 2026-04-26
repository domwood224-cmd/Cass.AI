import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Brain } from 'lucide-react';

export function KnowledgeGraphVisualizer({ data }: { data: { nodes: any[], edges: any[] } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current || data.nodes.length === 0) return;
    const width = containerRef.current.clientWidth;
    const height = 400;
    
    d3.select(containerRef.current).selectAll('*').remove();
    
    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`);

    const nodes = data.nodes.map(d => Object.create(d));
    const links = data.edges.map(d => Object.create(d));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(40));

    const link = svg.append('g')
      .attr('stroke', '#4f46e5')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', (d: any) => Math.sqrt(d.confidence || 0.5) * 2);

    const nodeGroup = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(drag(simulation) as any);

    nodeGroup.append('circle')
      .attr('r', (d: any) => 12 + (d.importance * 10))
      .attr('fill', '#4f46e5')
      .attr('stroke', '#312e81')
      .attr('stroke-width', 2);

    nodeGroup.append('text')
      .text((d: any) => d.label)
      .attr('x', 18)
      .attr('y', 4)
      .attr('fill', '#e4e4e7')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeGroup
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function drag(sim: any) {
      function dragstarted(event: any) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: any) {
        if (!event.active) sim.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
    
    return () => {
      simulation.stop();
    };
  }, [data]);

  if (data.nodes.length === 0) {
    return (
      <div className="w-full h-[400px] rounded-[2rem] border border-zinc-800/80 bg-zinc-900/30 flex flex-col items-center justify-center text-zinc-500">
        <Brain className="w-10 h-10 mb-3 opacity-20" />
        <span className="text-sm font-medium">Neural pathways unformed.</span>
        <span className="text-xs mt-1">Initiate conversation to begin training.</span>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-[400px] overflow-hidden rounded-[2rem] bg-[#09090b] border border-zinc-800" />;
}
