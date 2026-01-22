using Xunit;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace RxFlow.Validator.Tests
{
    public class MinimalParserTest
    {
        [Fact]
        public void CanInstantiateParser()
        {
            // Just verify we can create the parser
            var parser = new RxCodeParser();
            Assert.NotNull(parser);
        }

        [Fact]
        public void CanParseSyntaxTree()
        {
            // Verify basic syntax tree parsing works
            var code = "var x = 5;";
            var syntaxTree = CSharpSyntaxTree.ParseText(code);
            Assert.NotNull(syntaxTree);
        }

        [Fact]
        public void ParserReturnsNonNullGraph()
        {
            // Verify parser returns a result
            var code = "var x = 5;";
            var syntaxTree = CSharpSyntaxTree.ParseText(code);
            var parser = new RxCodeParser();
            var result = parser.Parse(syntaxTree);
            Assert.NotNull(result);
        }
    }
}
