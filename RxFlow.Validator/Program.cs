using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace RxFlow.Validator
{
    class Program
    {
        static void Main(string[] args)
        {
            // Determine mode: --validate or --parse
            bool parseMode = args.Contains("--parse");

            // Read source code from Stdin
            string sourceCode;
            using (var reader = new StreamReader(Console.OpenStandardInput()))
            {
                sourceCode = reader.ReadToEnd();
            }

            if (string.IsNullOrWhiteSpace(sourceCode))
            {
                Console.WriteLine(parseMode ? "{\"nodes\":[],\"edges\":[]}" : "[]");
                return;
            }

            var syntaxTree = CSharpSyntaxTree.ParseText(sourceCode);

            if (parseMode)
            {
                // Parse mode: Extract Rx operators and build graph
                var parser = new RxCodeParser();
                var result = parser.Parse(syntaxTree);
                Console.WriteLine(JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
            }
            else
            {
                // Validation mode: Check syntax errors
                var diagnostics = syntaxTree.GetDiagnostics();
                var results = diagnostics.Select(d => new ValidationResult
                {
                    Id = d.Id,
                    Message = d.GetMessage(),
                    Line = d.Location.GetLineSpan().StartLinePosition.Line + 1,
                    Severity = d.Severity.ToString()
                }).ToList();

                Console.WriteLine(JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));
            }
        }
    }

    public class ValidationResult
    {
        public string Id { get; set; }
        public string Message { get; set; }
        public int Line { get; set; }
        public string Severity { get; set; }
    }

    public class ParsedGraph
    {
        public List<ParsedNode> nodes { get; set; } = new List<ParsedNode>();
        public List<ParsedEdge> edges { get; set; } = new List<ParsedEdge>();
        public List<string> errors { get; set; } = new List<string>();
    }

    public class ParsedNode
    {
        public string id { get; set; }
        public string type { get; set; }
        public string label { get; set; }
        public Dictionary<string, object> parameters { get; set; } = new Dictionary<string, object>();
    }

    public class ParsedEdge
    {
        public string source { get; set; }
        public string target { get; set; }
    }

    public class RxCodeParser
    {
        private int nodeIdCounter = 0;
        private ParsedGraph graph = new ParsedGraph();

        // Map of Rx operator names to node types
        private static readonly Dictionary<string, string> OperatorTypeMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            // === CREATION OPERATORS (Sources) ===
            {"Interval", "source"}, {"Timer", "source"}, {"FromEvent", "source"}, {"FromEventPattern", "source"},
            {"FromAsync", "source"}, {"Return", "source"}, {"Range", "source"}, {"Generate", "source"},
            {"Create", "source"}, {"Defer", "source"}, {"Empty", "source"}, {"Never", "source"},
            {"Throw", "source"}, {"Using", "source"}, {"Repeat", "source"}, {"Start", "source"},
            {"StartAsync", "source"}, {"ToObservable", "source"},
            
            // === TRANSFORMATION + FILTERING OPERATORS (Pipes) ===
            {"Select", "pipe"}, {"SelectMany", "pipe"}, {"Cast", "pipe"}, {"OfType", "pipe"},
            {"Where", "pipe"}, {"Filter", "pipe"}, {"Take", "pipe"}, {"TakeWhile", "pipe"},
            {"TakeUntil", "pipe"}, {"TakeLast", "pipe"}, {"Skip", "pipe"}, {"SkipWhile", "pipe"},
            {"SkipUntil", "pipe"}, {"SkipLast", "pipe"}, {"Distinct", "pipe"}, {"DistinctUntilChanged", "pipe"},
            {"Debounce", "pipe"}, {"Throttle", "pipe"}, {"Sample", "pipe"}, {"Delay", "pipe"},
            {"Buffer", "pipe"}, {"Window", "pipe"}, {"Scan", "pipe"}, {"Aggregate", "pipe"},
            {"GroupBy", "pipe"}, {"Timestamp", "pipe"}, {"TimeInterval", "pipe"},
            {"Materialize", "pipe"}, {"Dematerialize", "pipe"}, {"FlatMap", "pipe"},
            
            // === ERROR HANDLING + UTILITY (Pipes) ===
            {"Retry", "pipe"}, {"Catch", "pipe"}, {"OnErrorResumeNext", "pipe"}, {"Finally", "pipe"},
            {"Timeout", "pipe"}, {"DelaySubscription", "pipe"}, {"ObserveOn", "pipe"}, {"SubscribeOn", "pipe"},
            {"Do", "pipe"}, {"Tap", "pipe"}, {"Publish", "pipe"}, {"Replay", "pipe"},
            {"RefCount", "pipe"}, {"Share", "pipe"}, {"Multicast", "pipe"},
            {"DefaultIfEmpty", "pipe"}, {"IgnoreElements", "pipe"},
            
            // === JOIN OPERATORS ===
            {"Merge", "join"}, {"Zip", "join"}, {"CombineLatest", "join"}, {"Amb", "join"},
            {"WithLatestFrom", "join"}, {"Switch", "join"}, {"Concat", "join"}, {"StartWith", "join"},
            
            // === SUBJECTS ===
            {"Subject", "subject"}, {"BehaviorSubject", "subject"}, 
            {"ReplaySubject", "subject"}, {"AsyncSubject", "subject"},
            
            // === SINKS (Terminal) ===
            {"Subscribe", "sink"}, {"ToList", "sink"}, {"ToArray", "sink"},
            {"Count", "sink"}, {"Sum", "sink"}, {"Min", "sink"}, {"Max", "sink"}, {"Average", "sink"},
            {"First", "sink"}, {"Last", "sink"}, {"Single", "sink"}, {"Any", "sink"}, {"All", "sink"}
        };

        private HashSet<InvocationExpressionSyntax> processedInvocations = new HashSet<InvocationExpressionSyntax>();

        public ParsedGraph Parse(SyntaxTree syntaxTree)
        {
            var root = syntaxTree.GetRoot();
            
            // Find all invocation chains (method call chains)
            var invocations = root.DescendantNodes().OfType<InvocationExpressionSyntax>().ToList();

            foreach (var invocation in invocations)
            {
                // Skip if already processed as part of a chain
                if (processedInvocations.Contains(invocation))
                    continue;

                // Check if this invocation is part of an Rx chain
                if (IsPartOfRxChain(invocation))
                {
                    ParseChain(invocation);
                }
            }

            return graph;
        }

        private bool IsPartOfRxChain(InvocationExpressionSyntax invocation)
        {
            // Walk up the expression tree to see if we hit Observable or Subject
            SyntaxNode current = invocation;
            while (current != null)
            {
                if (current is InvocationExpressionSyntax inv)
                {
                    var expr = inv.Expression;
                    if (expr is MemberAccessExpressionSyntax ma)
                    {
                        var name = ma.Expression.ToString();
                        if (name == "Observable" || name.Contains("Subject"))
                        {
                            return true;
                        }
                        current = ma.Expression;
                    }
                    else
                    {
                        break;
                    }
                }
                else if (current is MemberAccessExpressionSyntax memberAccess)
                {
                    current = memberAccess.Expression;
                }
                else
                {
                    break;
                }
            }
            return false;
        }

        private bool IsObservableChainStart(InvocationExpressionSyntax invocation)
        {
            // Check if it's Observable.Something or a Subject creation
            var expression = invocation.Expression;
            
            if (expression is MemberAccessExpressionSyntax memberAccess)
            {
                var name = memberAccess.Expression.ToString();
                return name == "Observable" || name.Contains("Subject");
            }
            
            return false;
        }

        private void ParseChain(InvocationExpressionSyntax startInvocation)
        {
            var chain = new List<InvocationExpressionSyntax>();
            
            // Walk up the chain to find all chained method calls
            SyntaxNode current = startInvocation;
            while (current != null)
            {
                if (current is InvocationExpressionSyntax inv)
                {
                    chain.Insert(0, inv);
                    processedInvocations.Add(inv); // Mark as processed
                    current = inv.Expression;
                    
                    // Stop if we hit the Observable.* call
                    if (current is MemberAccessExpressionSyntax ma && 
                        (ma.Expression.ToString() == "Observable" || ma.Expression.ToString().Contains("Subject")))
                    {
                        break;
                    }
                }
                else if (current is MemberAccessExpressionSyntax memberAccess)
                {
                    current = memberAccess.Expression;
                }
                else
                {
                    break;
                }
            }

            // Process the chain from start to end
            string previousNodeId = null;
            foreach (var invocation in chain)
            {
                var nodeId = ParseInvocation(invocation, previousNodeId);
                previousNodeId = nodeId;
            }
        }

        private string ParseInvocation(InvocationExpressionSyntax invocation, string previousNodeId)
        {
            string operatorName = ExtractOperatorName(invocation);
            if (string.IsNullOrEmpty(operatorName))
                return previousNodeId;

            // Determine node type
            string nodeType = "pipe"; // default
            if (OperatorTypeMap.TryGetValue(operatorName, out var mappedType))
            {
                nodeType = mappedType;
            }

            // Extract parameters
            var parameters = ExtractParameters(invocation, operatorName);

            // Create node
            var nodeId = $"n{++nodeIdCounter}";
            graph.nodes.Add(new ParsedNode
            {
                id = nodeId,
                type = nodeType,
                label = operatorName,
                parameters = parameters
            });

            // Create edge if there's a previous node
            if (previousNodeId != null)
            {
                graph.edges.Add(new ParsedEdge
                {
                    source = previousNodeId,
                    target = nodeId
                });
            }

            return nodeId;
        }

        private string ExtractOperatorName(InvocationExpressionSyntax invocation)
        {
            if (invocation.Expression is MemberAccessExpressionSyntax memberAccess)
            {
                return memberAccess.Name.Identifier.Text;
            }
            else if (invocation.Expression is IdentifierNameSyntax identifier)
            {
                return identifier.Identifier.Text;
            }
            
            return null;
        }

        private Dictionary<string, object> ExtractParameters(InvocationExpressionSyntax invocation, string operatorName)
        {
            var parameters = new Dictionary<string, object>();
            var args = invocation.ArgumentList.Arguments;

            // Extract parameters based on operator type
            switch (operatorName.ToLower())
            {
                case "interval":
                case "timer":
                case "debounce":
                case "delay":
                case "timeout":
                case "throttle":
                case "sample":
                    // Extract duration from TimeSpan.FromMilliseconds(...)
                    if (args.Count > 0)
                    {
                        var durationValue = ExtractDurationFromTimeSpan(args[0].Expression);
                        if (durationValue.HasValue)
                            parameters["duration"] = durationValue.Value;
                    }
                    break;

                case "select":
                case "where":
                case "selectmany":
                case "takewhile":
                case "skipwhile":
                case "takeuntil":
                case "skipuntil":
                case "groupby":
                    // Extract lambda expression
                    if (args.Count > 0)
                    {
                        var lambdaExpr = args[0].Expression.ToString();
                        parameters[operatorName.ToLower() == "groupby" ? "keySelector" : "expression"] = lambdaExpr;
                    }
                    break;

                case "scan":
                case "aggregate":
                    // Extract seed value and accumulator
                    if (args.Count > 1)
                    {
                        parameters["seed"] = args[0].Expression.ToString();
                        parameters["accumulator"] = args[1].Expression.ToString();
                    }
                    else if (args.Count > 0)
                    {
                        parameters["accumulator"] = args[0].Expression.ToString();
                    }
                    break;

                case "take":
                case "skip":
                case "takelast":
                case "skiplast":
                    // Extract count
                    if (args.Count > 0)
                        parameters["count"] = args[0].Expression.ToString();
                    break;

                case "buffer":
                case "window":
                    // Can be count or duration
                    if (args.Count > 0)
                    {
                        var firstArg = args[0].Expression;
                        if (firstArg.ToString().Contains("TimeSpan"))
                        {
                            var durationValue = ExtractDurationFromTimeSpan(firstArg);
                            if (durationValue.HasValue)
                                parameters["duration"] = durationValue.Value;
                        }
                        else
                        {
                            parameters["count"] = firstArg.ToString();
                        }
                    }
                    if (args.Count > 1)
                        parameters["skip"] = args[1].Expression.ToString();
                    break;

                case "range":
                    // Extract start and count
                    if (args.Count >= 2)
                    {
                        parameters["start"] = args[0].Expression.ToString();
                        parameters["count"] = args[1].Expression.ToString();
                    }
                    break;

                case "return":
                    // Extract value
                    if (args.Count > 0)
                        parameters["value"] = args[0].Expression.ToString();
                    break;

                case "behaviorsubject":
                    // Extract initial value
                    if (args.Count > 0)
                        parameters["initialValue"] = args[0].Expression.ToString();
                    break;

                case "replaysubject":
                    // Extract buffer size
                    if (args.Count > 0)
                        parameters["bufferSize"] = args[0].Expression.ToString();
                    break;

                case "retry":
                    // Extract retry count
                    if (args.Count > 0)
                        parameters["count"] = args[0].Expression.ToString();
                    break;

                case "catch":
                case "onerrorresumenext":
                    // Extract handler
                    if (args.Count > 0)
                        parameters["handler"] = args[0].Expression.ToString();
                    break;

                case "subscribe":
                    // Extract subscription handlers
                    for (int i = 0; i < args.Count; i++)
                    {
                        var handlerName = i == 0 ? "onNext" : i == 1 ? "onError" : "onCompleted";
                        parameters[handlerName] = args[i].Expression.ToString();
                    }
                    break;

                // For operators without specific parameter extraction, try generic extraction
                default:
                    for (int i = 0; i < args.Count; i++)
                    {
                        parameters[$"arg{i}"] = args[i].Expression.ToString();
                    }
                    break;
            }

            return parameters;
        }

        private int? ExtractDurationFromTimeSpan(ExpressionSyntax expression)
        {
            // Parse TimeSpan.FromMilliseconds(1000) or similar
            if (expression is InvocationExpressionSyntax inv &&
                inv.Expression is MemberAccessExpressionSyntax memberAccess)
            {
                var methodName = memberAccess.Name.Identifier.Text;
                if (methodName.StartsWith("From") && inv.ArgumentList.Arguments.Count > 0)
                {
                    var arg = inv.ArgumentList.Arguments[0].Expression.ToString();
                    if (int.TryParse(arg, out var value))
                    {
                        return value;
                    }
                }
            }

            return null;
        }
    }
}
