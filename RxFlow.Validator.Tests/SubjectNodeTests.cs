using Xunit;
using Microsoft.CodeAnalysis.CSharp;

namespace RxFlow.Validator.Tests
{
    public class SubjectNodeTests
    {
        private ParsedGraph ParseCode(string code)
        {
            var syntaxTree = CSharpSyntaxTree.ParseText(code);
            var parser = new RxCodeParser();
            return parser.Parse(syntaxTree);
        }

        [Fact]
        public void ParseBehaviorSubject_CreatesSubjectNode()
        {
            // Arrange
            var code = @"
                var subject = new BehaviorSubject<int>(0);
                subject.Subscribe(x => Console.WriteLine(x));
            ";

            // Act
            var result = ParseCode(code);

            // Assert
            Assert.Equal(2, result.nodes.Count);
            Assert.Equal("subject", result.nodes[0].type);
            Assert.Equal("BehaviorSubject", result.nodes[0].label);
            Assert.Equal("0", result.nodes[0].parameters["initialValue"]);
            
            Assert.Equal("sink", result.nodes[1].type);
            Assert.Equal("Subscribe", result.nodes[1].label);
        }

        [Fact]
        public void ParseReplaySubject_ExtractsBufferSize()
        {
            // Arrange
            var code = @"
                var replay = new ReplaySubject<string>(5);
                replay.Subscribe();
            ";

            // Act
            var result = ParseCode(code);

            // Assert
            Assert.Single(result.nodes.Where(n => n.type == "subject"));
            var subjectNode = result.nodes.First(n => n.type == "subject");
            Assert.Equal("ReplaySubject", subjectNode.label);
            Assert.Equal("5", subjectNode.parameters["bufferSize"]);
        }

        [Fact]
        public void SubjectChain_ConnectsCorrectly()
        {
            // Arrange
            var code = @"
                var subject = new BehaviorSubject<int>(0);
                subject
                    .Throttle(TimeSpan.FromMilliseconds(500))
                    .Subscribe(x => Console.WriteLine(x));
            ";

            // Act
            var result = ParseCode(code);

            // Assert
            Assert.Equal(3, result.nodes.Count);
            Assert.Equal(2, result.edges.Count);
            
            // Verify chain: Subject -> Throttle -> Subscribe
            Assert.Equal("n1", result.edges[0].source);
            Assert.Equal("n2", result.edges[0].target);
            Assert.Equal("n2", result.edges[1].source);
            Assert.Equal("n3", result.edges[1].target);
        }

        [Fact]
        public void AllSubjectTypes_ParseCorrectly()
        {
            // Test all Subject variants
            var subjects = new[]
            {
                ("new Subject<int>()", "Subject"),
                ("new BehaviorSubject<int>(42)", "BehaviorSubject"),
                ("new ReplaySubject<int>(10)", "ReplaySubject"),
                ("new AsyncSubject<int>()", "AsyncSubject")
            };

            foreach (var (code, expectedLabel) in subjects)
            {
                var fullCode = $"var s = {code}; s.Subscribe();";
                var result = ParseCode(fullCode);
                
                Assert.Contains(result.nodes, n => n.label == expectedLabel && n.type == "subject");
            }
        }

        [Fact]
        public void ComplexSubjectChain_ParsesAllNodes()
        {
            // Arrange
            var code = @"
                var subject = new BehaviorSubject<int>(0);
                subject
                    .Select(x => x * 2)
                    .Where(x => x > 5)
                    .Scan((acc, x) => acc + x, 0)
                    .Subscribe(x => Console.WriteLine(x));
            ";

            // Act
            var result = ParseCode(code);

            // Assert
            Assert.Equal(5, result.nodes.Count);
            Assert.Equal("subject", result.nodes[0].type);
            Assert.Equal("pipe", result.nodes[1].type);
            Assert.Equal("pipe", result.nodes[2].type);
            Assert.Equal("pipe", result.nodes[3].type);
            Assert.Equal("sink", result.nodes[4].type);
        }
    }
}
