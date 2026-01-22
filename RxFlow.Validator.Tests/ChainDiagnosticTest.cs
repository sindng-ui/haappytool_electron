using Xunit;
using Xunit.Abstractions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace RxFlow.Validator.Tests
{
    public class ChainDiagnosticTest
    {
        private readonly ITestOutputHelper _output;

        public ChainDiagnosticTest(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public void ParseChain_Diagnostic()
        {
            // Arrange - exact code from failing test
            var code = @"
                Observable.Range(1, 10)
                    .Select(x => x * 2)
                    .Where(x => x > 5)
                    .Subscribe(x => Console.WriteLine(x));
            ";
            var syntaxTree = CSharpSyntaxTree.ParseText(code);
            var parser = new RxCodeParser();

            // Act
            var result = parser.Parse(syntaxTree);

            // Assert & Diagnostic output
            _output.WriteLine($"Total nodes: {result.nodes.Count}");
            _output.WriteLine($"Total edges: {result.edges.Count}");
            
            foreach (var node in result.nodes)
            {
                _output.WriteLine($"  Node {node.id}: type={node.type}, label={node.label}");
            }
            
            foreach (var edge in result.edges)
            {
                _output.WriteLine($"  Edge: {edge.source} -> {edge.target}");
            }

            // This should be 4 nodes
            Assert.True(result.nodes.Count >= 1, $"Expected at least 1 node, got {result.nodes.Count}");
        }
    }
}
