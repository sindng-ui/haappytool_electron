import { Node, Edge } from '@xyflow/react';
import { RxNodeData } from '../constants';

export const generateCSharp = (nodes: Node<RxNodeData>[], edges: Edge[]): string => {
    if (nodes.length === 0) return '// No nodes to generate code from.';

    const lines: string[] = [];
    lines.push('using System;');
    lines.push('using System.Reactive.Linq;');
    lines.push('using System.Reactive.Subjects;');
    lines.push('');
    lines.push('public class RxStream');
    lines.push('{');
    lines.push('    public void Run()');
    lines.push('    {');

    // 1. Identify distinct trees/chains
    // We can iterate over "Sinks" and backtrack or start from "Sources" and traverse down.
    // Traversing from Sources is easier for linear code gen.

    // Find Source Nodes (no incoming edges)
    const sourceNodes = nodes.filter(n => !edges.some(e => e.target === n.id));
    const processedNodes = new Set<string>();

    sourceNodes.forEach(sourceNode => {
        const chain = buildChain(sourceNode, nodes, edges, processedNodes);
        if (chain) {
            lines.push(`        ${chain};`);
            lines.push('');
        }
    });

    lines.push('    }');
    lines.push('}');

    return lines.join('\n');
};

const buildChain = (
    currentNode: Node<RxNodeData>,
    nodes: Node<RxNodeData>[],
    edges: Edge[],
    processed: Set<string>
): string => {
    if (processed.has(currentNode.id)) return ''; // Handle loops or multi-connection logic later
    processed.add(currentNode.id);

    let code = '';
    const { label, params, type } = currentNode.data;
    const p = params || {};

    // Generate code for current node
    switch (type) {
        case 'source':
            if (label === 'Interval') code = `Observable.Interval(TimeSpan.FromMilliseconds(${p.duration || 1000}))`;
            else if (label === 'Timer') code = `Observable.Timer(TimeSpan.FromMilliseconds(${p.duration || 1000}))`;
            else if (label === 'FromEvent') code = `Observable.FromEventPattern(...)`;
            else code = `// Unknown Source ${label}`;
            break;

        case 'pipe':
            if (label === 'Select') code = `.Select(x => ${p.expression || 'x'})`;
            else if (label === 'Where') code = `.Where(x => ${p.expression || 'true'})`;
            else if (label === 'Scan') code = `.Scan(${p.seed || '0'}, (acc, x) => acc + x)`; // Simplified
            else if (label === 'Debounce') code = `.Debounce(TimeSpan.FromMilliseconds(${p.duration || 500}))`;
            else if (label === 'Delay') code = `.Delay(TimeSpan.FromMilliseconds(${p.duration || 1000}))`;
            else if (label === 'DistinctUntilChanged') code = `.DistinctUntilChanged()`;
            else if (label === 'ObserveOn') code = `.ObserveOn(Scheduler.Default)`;
            else code = `// Unknown Operator ${label}`;
            break;

        case 'join':
            // Join operators need multiple input streams
            // For now, generate a placeholder that shows the operator
            if (label === 'CombineLatest') code = `.CombineLatest(/* other stream */, (a, b) => new { a, b })`;
            else if (label === 'Merge') code = `.Merge(/* other stream */)`;
            else if (label === 'Zip') code = `.Zip(/* other stream */, (a, b) => new { a, b })`;
            else if (label === 'Amb') code = `.Amb(/* other stream */)`;
            else code = `// Join ${label}`;
            break;

        case 'sink':
            if (label === 'Subscribe') code = `.Subscribe(x => Console.WriteLine(x))`;
            else code = `// Sink ${label}`;
            break;
    }

    // Find next node(s)
    const outgoingEdges = edges.filter(e => e.source === currentNode.id);

    if (outgoingEdges.length > 0) {
        // Handling linear chain implies 1 outgoing. If multiple, it forks.
        // For C# fluent syntax, forking usually means saving to a variable.
        // Supporting only single linear path for now + simple recursion.

        const nextNode = nodes.find(n => n.id === outgoingEdges[0].target);
        if (nextNode) {
            const nextCode = buildChain(nextNode, nodes, edges, processed);
            // If current was source, just start. If pipe, append with dot.
            if (type === 'source') {
                return code + (nextCode.startsWith('.') ? nextCode : '');
            } else {
                return code + (nextCode.startsWith('.') ? nextCode : '');
            }
        }
    }

    return code;
};
