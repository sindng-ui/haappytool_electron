import { Node, Edge } from '@xyflow/react';
import { RxNodeData } from '../constants';
import {
    VirtualTimeScheduler,
    Observable,
    Subject,
    interval,
    timer,
    fromEvent,
    of,
    merge,
    zip,
    combineLatest,
    race
} from 'rxjs';
import {
    map,
    filter,
    scan,
    take,
    tap,
    delay,
    debounceTime,
    distinctUntilChanged,
    observeOn
} from 'rxjs/operators';

export interface SimulationResult {
    edgeEmissions: Record<string, any[]>; // edgeId -> events
    maxTime: number;
    sinkEmissions: Record<string, any[]>; // nodeId -> emissions
}

export const runSimulation = (
    nodes: Node<RxNodeData>[],
    edges: Edge[]
): SimulationResult => {

    // 1. Setup Scheduler
    const scheduler = new VirtualTimeScheduler(undefined, 10000); // Max frame 10s?? No, let's limit in execution
    const emissions: Record<string, any[]> = {};
    const sinkEmissions: Record<string, any[]> = {}; // Track emissions per sink node
    const observables: Record<string, Observable<any>> = {};

    // Helper to record emissions
    const record = (edgeId: string, value: any, type: 'next' | 'error' | 'complete' = 'next') => {
        if (!emissions[edgeId]) emissions[edgeId] = [];
        emissions[edgeId].push({
            time: scheduler.now(),
            value,
            type
        });
    };

    // Helper to record sink emissions
    const recordSink = (nodeId: string, value: any) => {
        if (!sinkEmissions[nodeId]) sinkEmissions[nodeId] = [];
        sinkEmissions[nodeId].push(value);
    };

    // 2. Build Observable Logic from Node Data
    // We need a way to resolve dependencies. Simple approach: Recursive resolution.

    const getObservable = (nodeId: string): Observable<any> | null => {
        if (observables[nodeId]) return observables[nodeId];

        const node = nodes.find(n => n.id === nodeId);
        if (!node) return null;

        // Find Input Edges
        const inputEdges = edges.filter(e => e.target === nodeId);
        const inputObservables = inputEdges.map(e => {
            const sourceObs = getObservable(e.source);
            if (!sourceObs) return of<any>(null); // Should not happen in valid graph

            // TAP HERE to record emissions on the incoming edge
            return sourceObs.pipe(
                tap({
                    next: (val) => record(e.id, val, 'next'),
                    error: (err) => record(e.id, err, 'error'),
                    complete: () => record(e.id, undefined, 'complete')
                })
            );
        });

        // Create current node's observable
        let obs: Observable<any>;
        const label = node.data.label;
        const params = node.data.params || {};

        try {
            switch (node.data.type) { // OR check category
                case 'source':
                    // Source nodes (0 inputs)
                    if (label === 'Interval') {
                        const period = Number(params.duration) || 1000;
                        obs = interval(period, scheduler).pipe(take(10)); // Limit infinite
                    } else if (label === 'Timer') {
                        const due = Number(params.duration) || 1000;
                        obs = timer(due, scheduler);
                    } else {
                        obs = of('mock-event').pipe(delay(500, scheduler));
                    }
                    break;

                case 'join':
                    // Join nodes (N inputs)
                    if (inputObservables.length === 0) {
                        obs = of(null); // No inputs
                    } else {
                        if (label === 'Merge') obs = merge(...inputObservables);
                        else if (label === 'Zip') obs = zip(...inputObservables);
                        else if (label === 'CombineLatest') obs = combineLatest(inputObservables);
                        else if (label === 'Amb') obs = race(...inputObservables);
                        else obs = merge(...inputObservables);
                    }
                    break;

                case 'subject':
                    // Subject nodes - create appropriate Subject type
                    const subjectType = label;
                    const manualInjections = node.data.manualInjections || [];

                    // Create the appropriate Subject
                    let subject: Subject<any>;
                    if (subjectType === 'BehaviorSubject') {
                        const initialValue = params.initialValue || 0;
                        subject = new Subject(); // RxJS BehaviorSubject requires import, use Subject for now
                        // Emit initial value
                        setTimeout(() => subject.next(initialValue), 0);
                    } else if (subjectType === 'ReplaySubject') {
                        subject = new Subject(); // Would use ReplaySubject(bufferSize) in real impl
                    } else if (subjectType === 'AsyncSubject') {
                        subject = new Subject(); // Would use AsyncSubject in real impl
                    } else {
                        subject = new Subject();
                    }

                    // Process manual injections from user (onNext/onError/onCompleted clicks)
                    manualInjections.forEach((injection: any) => {
                        const delay = injection.time ? (injection.time - Date.now()) : 0;
                        scheduler.schedule(() => {
                            if (injection.type === 'next') {
                                subject.next(injection.value);
                            } else if (injection.type === 'error') {
                                subject.error(injection.value || 'Error');
                            } else if (injection.type === 'complete') {
                                subject.complete();
                            }
                        }, Math.max(0, delay));
                    });

                    obs = subject.asObservable();
                    break;

                case 'pipe':
                case 'sink':
                    // Pipe/Sink (1 input usually, but we take first if multiple for pipe)
                    // In Rx, operators are applied to source.
                    const source = inputObservables[0] || of(null);

                    if (label === 'Select') {
                        // Simple eval for expression? DANGER. Use mocked logic for now.
                        // In real app, we might parse "x => x * 10" or "x * 10"
                        obs = source.pipe(map(x => `Mapped(${x})`));
                    } else if (label === 'Where') {
                        obs = source.pipe(filter(x => true)); // Pass all for now
                    } else if (label === 'Scan') {
                        obs = source.pipe(scan((acc, curr) => Number(acc) + 1, 0));
                    } else if (label === 'Debounce') {
                        obs = source.pipe(debounceTime(Number(params.duration) || 500, scheduler));
                    } else if (label === 'DistinctUntilChanged') {
                        obs = source.pipe(distinctUntilChanged());
                    } else if (label === 'ObserveOn') {
                        obs = source.pipe(observeOn(scheduler));
                    } else {
                        obs = source;
                    }
                    break;

                default:
                    obs = of(null);
            }
        } catch (e) {
            console.error('Error building observable', e);
            obs = of(null);
        }

        observables[nodeId] = obs;
        return obs;
    };

    // 3. Subscription (Trigger Flow)
    // Find Sinks (nodes with no output edges OR explicit Sink type)
    // Actually, we must process all nodes to ensure side-effects/recording happened?
    // No, only path to Sinks matters.
    const leafNodes = nodes.filter(n => {
        // Is it a sink type?
        if (n.data.type === 'sink') return true;
        // Or has no outgoing edges?
        const hasOutput = edges.some(e => e.source === n.id);
        return !hasOutput;
    });

    leafNodes.forEach(node => {
        const obs = getObservable(node.id);
        if (obs) {
            obs.subscribe({
                next: (val) => {
                    // Record emissions for sink nodes
                    if (node.data.type === 'sink') {
                        recordSink(node.id, val);
                    }
                },
                error: (err) => console.log('Sink Error', err),
                complete: () => console.log('Sink Complete')
            });
        }
    });

    // 4. Run Scheduler
    scheduler.flush(); // Run all virtual time tasks

    return {
        edgeEmissions: emissions,
        maxTime: scheduler.now(),
        sinkEmissions
    };
};
