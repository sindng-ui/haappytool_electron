using Xunit;
using Xunit.Abstractions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace RxFlow.Validator.Tests
{
    public class DiagnosticTest
    {
        private readonly ITestOutputHelper _output;

        public DiagnosticTest(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public void ParseSimpleInterval_Diagnostic()
        {
            // Arrange
            var code = "Observable.Interval(TimeSpan.FromMilliseconds(1000));";
            var syntaxTree = CSharpSyntaxTree.ParseText(code);
            var parser = new RxCodeParser();

            // Act
            var result = parser.Parse(syntaxTree);

            // Assert & Diagnostic output
            _output.WriteLine($"Nodes count: {result.nodes.Count}");
            _output.WriteLine($"Edges count: {result.edges.Count}");
            _output.WriteLine($"Errors count: {result.errors.Count}");
            
            foreach (var node in result.nodes)
            {
                _output.WriteLine($"Node: id={node.id}, type={node.type}, label={node.label}");
                foreach (var param in node.parameters)
                {
                    _output.WriteLine($"  Param: {param.Key} = {param.Value}");
                }
            }
            
            foreach (var edge in result.edges)
            {
                _output.WriteLine($"Edge: {edge.source} -> {edge.target}");
            }

            // Basic assertions
            Assert.NotNull(result);
            Assert.NotEmpty(result.nodes);
        }
    }
}
