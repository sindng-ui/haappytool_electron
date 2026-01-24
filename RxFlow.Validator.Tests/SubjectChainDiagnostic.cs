using Xunit;
using Xunit.Abstractions;
using Microsoft.CodeAnalysis.CSharp;

namespace RxFlow.Validator.Tests
{
    public class SubjectChainDiagnostic
    {
        private readonly ITestOutputHelper _output;

        public SubjectChainDiagnostic(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public void DiagnoseSubjectChain()
        {
            // Exact user code
            var code = @"
                var subject = new BehaviorSubject<int>(0);
                subject
                    .Throttle(TimeSpan.FromMilliseconds(500))
                    .Subscribe(x => Console.WriteLine(x));
            ";

            var syntaxTree = CSharpSyntaxTree.ParseText(code);
            var parser = new RxCodeParser();
            var result = parser.Parse(syntaxTree);

            _output.WriteLine($"Total nodes: {result.nodes.Count}");
            foreach (var node in result.nodes)
            {
                _output.WriteLine($"  Node {node.id}: type={node.type}, label={node.label}");
                foreach (var param in node.parameters)
                {
                    _output.WriteLine($"    {param.Key} = {param.Value}");
                }
            }

            _output.WriteLine($"\nTotal edges: {result.edges.Count}");
            foreach (var edge in result.edges)
            {
                _output.WriteLine($"  {edge.source} -> {edge.target}");
            }

            // MUST have 3 nodes!
            Assert.True(result.nodes.Count >= 3, $"Expected at least 3 nodes, got {result.nodes.Count}");
        }
    }
}
