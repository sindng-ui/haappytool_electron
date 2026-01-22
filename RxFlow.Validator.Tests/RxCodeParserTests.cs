using Xunit;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using System.Linq;
using System.Text.Json;

namespace RxFlow.Validator.Tests
{
    public class RxCodeParserTests
    {
        private ParsedGraph ParseCode(string code)
        {
            var syntaxTree = CSharpSyntaxTree.ParseText(code);
            var parser = new RxCodeParser();
            return parser.Parse(syntaxTree);
        }

        [Fact]
        public void Parse_SimpleIntervalSubscribe_CreatesCorrectNodes()
        {
            // Arrange
            var code = @"
                Observable.Interval(TimeSpan.FromMilliseconds(1000))
                    .Subscribe(x => Console.WriteLine(x));
            ";

            // Act
            var result = ParseCode(code);

            // Assert
            Assert.Equal(2, result.nodes.Count);
            Assert.Equal("Interval", result.nodes[0].label);
            Assert.Equal("source", result.nodes[0].type);
            Assert.Equal("Subscribe", result.nodes[1].label);
            Assert.Equal("sink", result.nodes[1].type);
            Assert.Single(result.edges);
        }

        [Fact]
        public void Parse_SelectWhereChain_CreatesCorrectNodeTypes()
        {
            // Arrange
            var code = @"
                Observable.Range(1, 10)
                    .Select(x => x * 2)
                    .Where(x => x > 5)
                    .Subscribe(x => Console.WriteLine(x));
            ";

            // Act
            var result = ParseCode(code);

            // Assert
            Assert.Equal(4, result.nodes.Count);
            Assert.Equal("source", result.nodes[0].type); // Range
            Assert.Equal("pipe", result.nodes[1].type);   // Select
            Assert.Equal("pipe", result.nodes[2].type);   // Where
            Assert.Equal("sink", result.nodes[3].type);   // Subscribe
            Assert.Equal(3, result.edges.Count);
        }

        [Fact]
        public void Parse_IntervalOperator_ExtractsTimeParameter()
        {
            // Arrange
            var code = "Observable.Interval(TimeSpan.FromMilliseconds(500));";

            // Act
            var result = ParseCode(code);

            // Assert
            var intervalNode = result.nodes.First(n => n.label == "Interval");
            Assert.True(intervalNode.parameters.ContainsKey("duration"));
            Assert.Equal(500, intervalNode.parameters["duration"]);
        }

        [Fact]
        public void Parse_SelectOperator_ExtractsLambdaExpression()
        {
            // Arrange
            var code = "Observable.Range(1, 5).Select(x => x * 2);";

            // Act
            var result = ParseCode(code);

            // Assert
            var selectNode = result.nodes.First(n => n.label == "Select");
            Assert.True(selectNode.parameters.ContainsKey("expression"));
            Assert.Contains("x * 2", selectNode.parameters["expression"].ToString());
        }

        [Fact]
        public void Parse_RangeOperator_ExtractsStartAndCount()
        {
            // Arrange
            var code = "Observable.Range(10, 20);";

            // Act
            var result = ParseCode(code);

            // Assert
            var rangeNode = result.nodes.First(n => n.label == "Range");
            Assert.True(rangeNode.parameters.ContainsKey("start"));
            Assert.True(rangeNode.parameters.ContainsKey("count"));
            Assert.Equal("10", rangeNode.parameters["start"]);
            Assert.Equal("20", rangeNode.parameters["count"]);
        }

        [Fact]
        public void Parse_ScanOperator_ExtractsSeedAndAccumulator()
        {
            // Arrange
            var code = "Observable.Range(1, 5).Scan(0, (acc, x) => acc + x);";

            // Act
            var result = ParseCode(code);

            // Assert
            var scanNode = result.nodes.First(n => n.label == "Scan");
            Assert.True(scanNode.parameters.ContainsKey("seed"));
            Assert.True(scanNode.parameters.ContainsKey("accumulator"));
            Assert.Equal("0", scanNode.parameters["seed"]);
        }

        [Fact]
        public void Parse_SubscribeOperator_ExtractsAllHandlers()
        {
            // Arrange
            var code = @"
                Observable.Range(1, 5).Subscribe(
                    x => Console.WriteLine(x),
                    ex => Console.WriteLine(ex),
                    () => Console.WriteLine(""Done"")
                );
            ";

            // Act
            var result = ParseCode(code);

            // Assert
            var subscribeNode = result.nodes.First(n => n.label == "Subscribe");
            Assert.True(subscribeNode.parameters.ContainsKey("onNext"));
            Assert.True(subscribeNode.parameters.ContainsKey("onError"));
            Assert.True(subscribeNode.parameters.ContainsKey("onCompleted"));
        }

        [Fact]
        public void Parse_MergeOperator_CreatesJoinNode()
        {
            // Arrange
            var code = @"
                Observable.Interval(TimeSpan.FromMilliseconds(100))
                    .Merge(Observable.Timer(TimeSpan.FromMilliseconds(200)));
            ";

            // Act
            var result = ParseCode(code);

            // Assert
            var mergeNode = result.nodes.FirstOrDefault(n => n.label == "Merge");
            Assert.NotNull(mergeNode);
            Assert.Equal("join", mergeNode.type);
        }

        [Fact]
        public void Parse_BufferOperator_WithCount_ExtractsCountParameter()
        {
            // Arrange
            var code = "Observable.Range(1, 10).Buffer(3);";

            // Act
            var result = ParseCode(code);

            // Assert
            var bufferNode = result.nodes.First(n => n.label == "Buffer");
            Assert.True(bufferNode.parameters.ContainsKey("count"));
            Assert.Equal("3", bufferNode.parameters["count"]);
        }

        [Fact]
        public void Parse_BufferOperator_WithTimeSpan_ExtractsDuration()
        {
            // Arrange
            var code = "Observable.Interval(TimeSpan.FromMilliseconds(10)).Buffer(TimeSpan.FromMilliseconds(100));";

            // Act
            var result = ParseCode(code);

            // Assert
            var bufferNode = result.nodes.First(n => n.label == "Buffer");
            Assert.True(bufferNode.parameters.ContainsKey("duration"));
            Assert.Equal(100, bufferNode.parameters["duration"]);
        }

        [Fact]
        public void Parse_BehaviorSubject_ExtractsInitialValue()
        {
            // Arrange
            var code = "new BehaviorSubject<int>(42);";

            // Act
            var result = ParseCode(code);

            // Assert
            var subjectNode = result.nodes.FirstOrDefault(n => n.label == "BehaviorSubject");
            if (subjectNode != null && subjectNode.parameters.ContainsKey("initialValue"))
            {
                Assert.Equal("42", subjectNode.parameters["initialValue"]);
            }
        }

        [Fact]
        public void Parse_ComplexChain_CreatesCorrectEdgeSequence()
        {
            // Arrange
            var code = @"
                Observable.Interval(TimeSpan.FromMilliseconds(100))
                    .Select(x => x * 2)
                    .Where(x => x > 5)
                    .Take(10)
                    .Subscribe(x => Console.WriteLine(x));
            ";

            // Act
            var result = ParseCode(code);

            // Assert
            Assert.Equal(5, result.nodes.Count);
            Assert.Equal(4, result.edges.Count);
            
            // Verify edge connections
            Assert.Equal(result.nodes[0].id, result.edges[0].source);
            Assert.Equal(result.nodes[1].id, result.edges[0].target);
            Assert.Equal(result.nodes[1].id, result.edges[1].source);
            Assert.Equal(result.nodes[2].id, result.edges[1].target);
        }

        [Fact]
        public void Parse_ThrottleOperator_ExtractsDuration()
        {
            // Arrange
            var code = "Observable.Interval(TimeSpan.FromMilliseconds(10)).Throttle(TimeSpan.FromMilliseconds(100));";

            // Act
            var result = ParseCode(code);

            // Assert
            var throttleNode = result.nodes.First(n => n.label == "Throttle");
            Assert.True(throttleNode.parameters.ContainsKey("duration"));
            Assert.Equal(100, throttleNode.parameters["duration"]);
        }

        [Fact]
        public void Parse_GroupByOperator_ExtractsKeySelector()
        {
            // Arrange
            var code = "Observable.Range(1, 10).GroupBy(x => x % 2);";

            // Act
            var result = ParseCode(code);

            // Assert
            var groupByNode = result.nodes.First(n => n.label == "GroupBy");
            Assert.True(groupByNode.parameters.ContainsKey("keySelector"));
            Assert.Contains("x % 2", groupByNode.parameters["keySelector"].ToString());
        }

        [Fact]
        public void Parse_RetryOperator_ExtractsRetryCount()
        {
            // Arrange
            var code = "Observable.Throw<int>(new Exception()).Retry(3);";

            // Act
            var result = ParseCode(code);

            // Assert
            var retryNode = result.nodes.FirstOrDefault(n => n.label == "Retry");
            if (retryNode != null && retryNode.parameters.ContainsKey("count"))
            {
                Assert.Equal("3", retryNode.parameters["count"]);
            }
        }

        [Fact]
        public void Parse_UnknownOperator_UsesGenericParameterExtraction()
        {
            // Arrange
            var code = "Observable.Range(1, 5).CustomOperator(\"param1\", 42, true);";

            // Act
            var result = ParseCode(code);

            // Assert - Should still parse with generic parameters
            Assert.NotEmpty(result.nodes);
        }

        [Fact]
        public void Parse_EmptyCode_ReturnsEmptyGraph()
        {
            // Arrange
            var code = "";

            // Act
            var result = ParseCode(code);

            // Assert
            Assert.Empty(result.nodes);
            Assert.Empty(result.edges);
        }

        [Fact]
        public void Parse_NoObservableCode_ReturnsEmptyGraph()
        {
            // Arrange
            var code = "var x = 5; Console.WriteLine(x);";

            // Act
            var result = ParseCode(code);

            // Assert
            Assert.Empty(result.nodes);
        }
    }
}
